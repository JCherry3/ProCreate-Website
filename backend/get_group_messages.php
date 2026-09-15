<?php
session_start();
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

if (!isset($_SESSION["user_id"])) {
    http_response_code(401);
    exit(json_encode(["error" => "Not authenticated"]));
}

$current_user_id = (int)$_SESSION["user_id"];
$input           = json_decode(file_get_contents("php://input"), true);
$conversation_id = isset($input["conversation_id"]) ? (int)$input["conversation_id"] : 0;

if ($conversation_id <= 0) {
    http_response_code(400);
    exit(json_encode(["error" => "conversation_id is required"]));
}

require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    exit(json_encode(["error" => "Database connection failed"]));
}

// Verify membership
$mem_stmt = $conn->prepare("
    SELECT 1 FROM group_conversation_members
    WHERE conversation_id = ? AND user_id = ?
    LIMIT 1
");
$mem_stmt->bind_param("ii", $conversation_id, $current_user_id);
$mem_stmt->execute();
if ($mem_stmt->get_result()->num_rows === 0) {
    http_response_code(403);
    exit(json_encode(["error" => "You are not a member of this group"]));
}
$mem_stmt->close();

// Mark all messages from others as read now that this user has opened the conversation
$conn->query("
    UPDATE group_messages
    SET is_read = 1
    WHERE conversation_id = $conversation_id
      AND sender_id != $current_user_id
      AND is_read = 0
");

// Fetch group info
$info_stmt = $conn->prepare("
    SELECT gc.group_name, gc.created_by, gc.project_id
    FROM group_conversations gc
    WHERE gc.conversation_id = ?
");
$info_stmt->bind_param("i", $conversation_id);
$info_stmt->execute();
$info_row = $info_stmt->get_result()->fetch_assoc();
$info_stmt->close();

// Fetch members with profile info
$members_stmt = $conn->prepare("
    SELECT gcm.user_id, p.username, CONCAT(p.`first name`, ' ', p.`last name`) AS display_name, ui.pic
    FROM group_conversation_members gcm
    JOIN profile p ON p.user_id = gcm.user_id
    LEFT JOIN user_info ui ON ui.user_id = gcm.user_id
    WHERE gcm.conversation_id = ?
");
$members_stmt->bind_param("i", $conversation_id);
$members_stmt->execute();
$members_result = $members_stmt->get_result();
$members = [];
while ($m = $members_result->fetch_assoc()) {
    $members[] = [
        "id"           => (int)$m["user_id"],
        "username"     => $m["username"],
        "display_name" => trim($m["display_name"]),
        "pic"          => $m["pic"] ?: null,
    ];
}
$members_stmt->close();

// Fetch messages
$msg_stmt = $conn->prepare("
    SELECT gm.message_id, gm.sender_id, gm.body, gm.sent_at,
           p.username AS sender_username,
           CONCAT(p.`first name`, ' ', p.`last name`) AS sender_display_name,
           ui.pic AS sender_pic
    FROM group_messages gm
    JOIN profile p ON p.user_id = gm.sender_id
    LEFT JOIN user_info ui ON ui.user_id = gm.sender_id
    WHERE gm.conversation_id = ?
    ORDER BY gm.sent_at ASC
");
$msg_stmt->bind_param("i", $conversation_id);
$msg_stmt->execute();
$msg_result = $msg_stmt->get_result();
$messages = [];
$message_ids = [];
while ($row = $msg_result->fetch_assoc()) {
    $mid = (int)$row["message_id"];
    $message_ids[] = $mid;
    $messages[] = [
        "id"                   => $mid,
        "sender_id"            => (int)$row["sender_id"],
        "sender_username"      => $row["sender_username"],
        "sender_display_name"  => trim($row["sender_display_name"]),
        "sender_pic"           => $row["sender_pic"] ?: null,
        "body"                 => $row["body"],
        "sent_at"              => $row["sent_at"],
        "attachments"          => [],
    ];
}
$msg_stmt->close();

// Fetch attachments for these messages (if the table exists)
if (count($message_ids) > 0) {
    $placeholders = implode(",", array_fill(0, count($message_ids), "?"));
    $att_stmt = $conn->prepare(
        "SELECT message_id, id AS attachment_id, original_name, stored_name, mime_type, file_size
         FROM group_message_attachments
         WHERE message_id IN ($placeholders)
         ORDER BY id ASC"
    );
    if ($att_stmt) {
        $types = str_repeat("i", count($message_ids));
        $att_stmt->bind_param($types, ...$message_ids);
        $att_stmt->execute();
        $att_result = $att_stmt->get_result();
        // Index attachments by message_id for fast lookup
        $attByMsg = [];
        while ($arow = $att_result->fetch_assoc()) {
            $attByMsg[(int)$arow["message_id"]][] = [
                "id"            => (int)$arow["attachment_id"],
                "original_name" => $arow["original_name"],
                "stored_name"   => $arow["stored_name"],
                "url"           => "message_attachments_files/" . $arow["stored_name"],
                "mime_type"     => $arow["mime_type"],
                "file_size"     => (int)$arow["file_size"],
            ];
        }
        $att_stmt->close();
        // Attach to messages
        foreach ($messages as &$msg) {
            if (isset($attByMsg[$msg["id"]])) {
                $msg["attachments"] = $attByMsg[$msg["id"]];
            }
        }
        unset($msg);
    }
}
$conn->close();

echo json_encode([
    "success"         => true,
    "current_user_id" => $current_user_id,
    "conversation_id" => $conversation_id,
    "group_name"      => $info_row["group_name"] ?? "",
    "project_id"      => $info_row["project_id"] ? (int)$info_row["project_id"] : null,
    "members"         => $members,
    "messages"        => $messages,
]);
?>
