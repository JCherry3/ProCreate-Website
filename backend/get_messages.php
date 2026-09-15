<?php
// ------------------ DEBUG ------------------
ini_set('display_errors', 1);
error_reporting(E_ALL);

// ------------------ HEADERS ------------------
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Preflight
if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    echo json_encode(["success" => true]);
    exit;
}

// Only POST
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["error" => "Method not allowed"]);
    exit;
}

// ------------------ SESSION ------------------
session_start();

// ------------------ INPUT ------------------
$user_id = isset($_SESSION["user_id"]) ? (int)$_SESSION["user_id"] : 0;

if ($user_id === 0 && isset($_POST["user_id"])) {
    $user_id = (int)$_POST["user_id"];
}

$other_user_id = isset($_POST["other_user_id"]) ? (int)$_POST["other_user_id"] : 0;

if ($user_id === 0) {
    http_response_code(401);
    echo json_encode(["error" => "Not authenticated"]);
    exit;
}

if ($other_user_id === 0) {
    http_response_code(400);
    echo json_encode(["error" => "Missing other_user_id"]);
    exit;
}

// ------------------ DB ------------------
require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode([
        "error" => "Database connection failed",
        "details" => $conn->connect_error
    ]);
    exit;
}

try {
    // ------------------ FETCH MESSAGES ------------------
    $stmt = $conn->prepare("
        SELECT message_id, sender_id, recipient_id, body, sent_at, is_read
        FROM messages
        WHERE (sender_id = ? AND recipient_id = ?)
           OR (sender_id = ? AND recipient_id = ?)
        ORDER BY sent_at ASC
    ");

    if (!$stmt) {
        throw new Exception("Prepare failed: " . $conn->error);
    }

    $stmt->bind_param("iiii", $user_id, $other_user_id, $other_user_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $stmt->close();

    // ------------------ COLLECT MESSAGES ------------------
    $message_ids  = [];
    $raw_messages = [];

    while ($row = $result->fetch_assoc()) {
        $mid = (int)$row["message_id"];
        $message_ids[] = $mid;
        $raw_messages[$mid] = [
            "id"           => $mid,
            "sender_id"    => (int)$row["sender_id"],
            "recipient_id" => (int)$row["recipient_id"],
            "body"         => $row["body"],
            "sent_at"      => $row["sent_at"],
            "is_read"      => (int)$row["is_read"],
            "attachments"  => [],
        ];
    }

    // ------------------ FETCH ATTACHMENTS ------------------
    if (!empty($message_ids)) {
        $placeholders = implode(",", array_fill(0, count($message_ids), "?"));
        $types        = str_repeat("i", count($message_ids));

        $att_stmt = $conn->prepare("
            SELECT message_id, attachment_id, original_name, stored_name, mime_type, file_size
            FROM message_attachments
            WHERE message_id IN ($placeholders)
            ORDER BY attachment_id ASC
        ");

        if (!$att_stmt) {
            throw new Exception("Attachment prepare failed: " . $conn->error);
        }

        $att_stmt->bind_param($types, ...$message_ids);
        $att_stmt->execute();
        $att_result = $att_stmt->get_result();

        while ($att = $att_result->fetch_assoc()) {
            $mid = (int)$att["message_id"];
            $raw_messages[$mid]["attachments"][] = [
                "id"            => (int)$att["attachment_id"],
                "original_name" => $att["original_name"],
                "url"           => "message_attachments_files/" . $att["stored_name"],
                "mime_type"     => $att["mime_type"],
                "file_size"     => (int)$att["file_size"],
            ];
        }
        $att_stmt->close();
    }

    $messages = array_values($raw_messages);

    // ------------------ MARK AS READ ------------------
    $mark_stmt = $conn->prepare("
        UPDATE messages
        SET is_read = 1
        WHERE sender_id = ? AND recipient_id = ? AND is_read = 0
    ");

    if ($mark_stmt) {
        $mark_stmt->bind_param("ii", $other_user_id, $user_id);
        $mark_stmt->execute();
        $mark_stmt->close();
    }

    echo json_encode([
        "success"         => true,
        "current_user_id" => $user_id,
        "messages"        => $messages
    ]);

    $conn->close();

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "error"   => "Server error",
        "details" => $e->getMessage()
    ]);
}