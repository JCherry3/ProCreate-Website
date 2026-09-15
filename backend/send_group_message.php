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
$body            = isset($input["body"])            ? trim($input["body"])            : "";
$attachments     = isset($input["attachments"])     ? $input["attachments"]           : [];

if ($conversation_id <= 0) {
    http_response_code(400);
    exit(json_encode(["error" => "conversation_id is required"]));
}

if ($body === "" && count($attachments) === 0) {
    http_response_code(400);
    exit(json_encode(["error" => "Message body or attachment is required"]));
}

if ($body !== "" && mb_strlen($body) > 5000) {
    http_response_code(400);
    exit(json_encode(["error" => "Message exceeds 5000 characters"]));
}

require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    exit(json_encode(["error" => "Database connection failed"]));
}

// Ensure group_message_attachments table exists
$conn->query(
    "CREATE TABLE IF NOT EXISTS group_message_attachments (" .
    "    id INT AUTO_INCREMENT PRIMARY KEY," .
    "    message_id INT NOT NULL," .
    "    original_name VARCHAR(255) NOT NULL," .
    "    stored_name VARCHAR(255) NOT NULL," .
    "    mime_type VARCHAR(100) NOT NULL," .
    "    file_size INT NOT NULL," .
    "    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," .
    "    INDEX idx_message_id (message_id)" .
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci"
);

// Verify membership
$mem_stmt = $conn->prepare("
    SELECT 1 FROM group_conversation_members
    WHERE conversation_id = ? AND user_id = ?
    LIMIT 1
");
$mem_stmt->bind_param("ii", $conversation_id, $current_user_id);
$mem_stmt->execute();
if ($mem_stmt->get_result()->num_rows === 0) {
    $conn->close();
    http_response_code(403);
    exit(json_encode(["error" => "You are not a member of this group conversation"]));
}
$mem_stmt->close();

try {
    $conn->begin_transaction();

    // Insert message
    $ins_stmt = $conn->prepare("
        INSERT INTO group_messages (conversation_id, sender_id, body, sent_at)
        VALUES (?, ?, ?, NOW())
    ");
    $ins_stmt->bind_param("iis", $conversation_id, $current_user_id, $body);
    if (!$ins_stmt->execute()) {
        throw new Exception("Failed to send message");
    }
    $message_id = $conn->insert_id;
    $ins_stmt->close();

    // Handle attachments (uploaded via upload_chunk.php, finalized here)
    $uploadDir = __DIR__ . "/message_attachments_files/";
    foreach ($attachments as $att) {
        $stored_name   = basename($att["stored_name"] ?? "");
        $original_name = $att["original_name"] ?? $stored_name;
        $mime_type     = $att["mime_type"]     ?? "application/octet-stream";
        $file_size     = (int)($att["file_size"] ?? 0);

        if ($stored_name === "" || !file_exists($uploadDir . $stored_name)) continue;

        // Rename to tie it to this message
        $new_stored = "grpmsg_{$message_id}_" . bin2hex(random_bytes(4)) . "_" . time() . ".bin";
        rename($uploadDir . $stored_name, $uploadDir . $new_stored);

        $att_stmt = $conn->prepare("
            INSERT INTO group_message_attachments (message_id, original_name, stored_name, mime_type, file_size)
            VALUES (?, ?, ?, ?, ?)
        ");
        $att_stmt->bind_param("isssi", $message_id, $original_name, $new_stored, $mime_type, $file_size);
        if (!$att_stmt->execute()) throw new Exception("Attachment insert failed");
        $att_stmt->close();
    }

    $conn->commit();

    echo json_encode([
        "success"    => true,
        "message_id" => $message_id,
    ]);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["error" => "Internal error: " . $e->getMessage()]);
} finally {
    $conn->close();
}
?>
