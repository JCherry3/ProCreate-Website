<?php
// api/get_conversations.php
session_start();
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed"]);
    exit;
}

$body = file_get_contents("php://input");
$data = json_decode($body, true);

$user_id = isset($_SESSION["user_id"])
    ? (int)$_SESSION["user_id"]
    : (isset($data["user_id"]) ? (int)$data["user_id"] : 0);

if ($user_id === 0) {
    http_response_code(401);
    echo json_encode(["error" => "Not authenticated."]);
    exit;
}

// ── 1. Direct message conversations ─────────────────────────────────────────
$dm_sql = "
    SELECT
        latest.message_id                                     AS id,
        other_p.user_id                                       AS other_user_id,
        other_p.username                                      AS other_user_username,
        CONCAT(other_p.`first name`, ' ', other_p.`last name`) AS other_user_display_name,
        other_ui.pic                                          AS other_user_pic,
        latest.body                                           AS last_message,
        latest.sent_at                                        AS last_message_at,
        COALESCE(unread.cnt, 0)                               AS unread_count
    FROM (
        SELECT
            CASE
                WHEN sender_id = ? THEN recipient_id
                ELSE sender_id
            END AS contact_id,
            MAX(message_id) AS max_id
        FROM messages
        WHERE sender_id = ? OR recipient_id = ?
        GROUP BY contact_id
    ) AS conv
    JOIN messages AS latest ON latest.message_id = conv.max_id
    JOIN profile AS other_p ON other_p.user_id = conv.contact_id
    LEFT JOIN user_info AS other_ui ON other_ui.user_id = conv.contact_id
    LEFT JOIN (
        SELECT sender_id, COUNT(*) AS cnt
        FROM messages
        WHERE recipient_id = ? AND is_read = 0
        GROUP BY sender_id
    ) AS unread ON unread.sender_id = conv.contact_id
    ORDER BY latest.sent_at DESC
";

$stmt = $conn->prepare($dm_sql);
$stmt->bind_param("iiii", $user_id, $user_id, $user_id, $user_id);
$stmt->execute();
$result = $stmt->get_result();

$conversations = [];

while ($row = $result->fetch_assoc()) {
    $conversations[] = [
        "id"              => (int)$row["id"],
        "type"            => "dm",
        "other_user"      => [
            "id"           => (int)$row["other_user_id"],
            "username"     => $row["other_user_username"],
            "display_name" => trim($row["other_user_display_name"]),
            "pic"          => $row["other_user_pic"] ?: null,
        ],
        "last_message"    => $row["last_message"],
        "last_message_at" => $row["last_message_at"],
        "unread_count"    => (int)$row["unread_count"],
    ];
}
$stmt->close();

// ── 2. Group conversations (only if tables exist) ────────────────────────────
$tables = $conn->query("SHOW TABLES LIKE 'group_conversations'");
if ($tables && $tables->num_rows > 0) {

    $group_sql = "
        SELECT
            gc.conversation_id,
            gc.group_name,
            gc.project_id,
            COALESCE(last_msg.body, '') AS last_message,
            COALESCE(last_msg.sent_at, gc.created_at) AS last_message_at,
            COALESCE(unread.cnt, 0) AS unread_count
        FROM group_conversations gc
        JOIN group_conversation_members gcm ON gcm.conversation_id = gc.conversation_id
            AND gcm.user_id = ?
        LEFT JOIN (
            SELECT gm.conversation_id, gm.body, gm.sent_at
            FROM group_messages gm
            INNER JOIN (
                SELECT conversation_id, MAX(message_id) AS max_id
                FROM group_messages
                GROUP BY conversation_id
            ) latest ON latest.conversation_id = gm.conversation_id AND latest.max_id = gm.message_id
        ) AS last_msg ON last_msg.conversation_id = gc.conversation_id
        LEFT JOIN (
            SELECT conversation_id, COUNT(*) AS cnt
            FROM group_messages
            WHERE is_read = 0 AND sender_id != ?
            GROUP BY conversation_id
        ) AS unread ON unread.conversation_id = gc.conversation_id
        ORDER BY last_message_at DESC
    ";

    $g_stmt = $conn->prepare($group_sql);
    $g_stmt->bind_param("ii", $user_id, $user_id);
    $g_stmt->execute();
    $g_result = $g_stmt->get_result();

    while ($row = $g_result->fetch_assoc()) {
        $conv_id = (int)$row["conversation_id"];

        // Fetch members for this group
        $mem_stmt = $conn->prepare("
            SELECT gcm.user_id, p.username,
                   CONCAT(p.`first name`, ' ', p.`last name`) AS display_name,
                   ui.pic
            FROM group_conversation_members gcm
            JOIN profile p ON p.user_id = gcm.user_id
            LEFT JOIN user_info ui ON ui.user_id = gcm.user_id
            WHERE gcm.conversation_id = ?
        ");
        $mem_stmt->bind_param("i", $conv_id);
        $mem_stmt->execute();
        $mem_result = $mem_stmt->get_result();
        $members = [];
        while ($m = $mem_result->fetch_assoc()) {
            $members[] = [
                "id"           => (int)$m["user_id"],
                "username"     => $m["username"],
                "display_name" => trim($m["display_name"]),
                "pic"          => $m["pic"] ?: null,
            ];
        }
        $mem_stmt->close();

        // Build a safe other_user stub so old frontend bundles that blindly access
        // other_user.username don't crash. New frontend checks type === "group" first.
        $first_member_name = count($members) > 0 ? ($members[0]["display_name"] ?: $members[0]["username"]) : "Group";
        $conversations[] = [
            "id"              => $conv_id,
            "type"            => "group",
            "group_name"      => $row["group_name"],
            "project_id"      => $row["project_id"] ? (int)$row["project_id"] : null,
            "members"         => $members,
            "other_user"      => [
                "id"           => 0,
                "username"     => $row["group_name"] ?? "Group Chat",
                "display_name" => $row["group_name"] ?? "Group Chat",
                "pic"          => null,
            ],
            "last_message"    => $row["last_message"],
            "last_message_at" => $row["last_message_at"],
            "unread_count"    => (int)$row["unread_count"],
        ];
    }
    $g_stmt->close();
}

// Sort all conversations by last_message_at desc
usort($conversations, function ($a, $b) {
    return strtotime($b["last_message_at"]) - strtotime($a["last_message_at"]);
});

echo json_encode(["current_user_id" => $user_id, "conversations" => $conversations]);

$conn->close();
