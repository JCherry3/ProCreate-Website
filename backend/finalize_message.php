<?php
header("Content-Type: application/json");
session_start();

$user_id = isset($_SESSION["user_id"]) ? (int)$_SESSION["user_id"] : 0;
if ($user_id === 0) {
    http_response_code(401);
    exit(json_encode(["error" => "Not authenticated"]));
}

$input        = json_decode(file_get_contents("php://input"), true);
$recipient_id = isset($input["recipient_id"]) ? (int)$input["recipient_id"] : 0;
$body         = isset($input["body"])         ? trim($input["body"])         : "";
$attachments  = isset($input["attachments"])  ? $input["attachments"]        : [];

if ($recipient_id <= 0 || ($body === "" && count($attachments) === 0)) {
    http_response_code(400);
    exit(json_encode(["error" => "Recipient and body or attachment required"]));
}

require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    exit(json_encode(["error" => "DB connection failed"]));
}

try {
    $conn->begin_transaction();

    $stmt = $conn->prepare("
        INSERT INTO messages (sender_id, recipient_id, subject, body, sent_at, is_read)
        VALUES (?, ?, '(no subject)', ?, NOW(), 0)
    ");
    $stmt->bind_param("iis", $user_id, $recipient_id, $body);
    if (!$stmt->execute()) throw new Exception("Message insert failed");
    $message_id = $stmt->insert_id;
    $stmt->close();

    $uploadDir = __DIR__ . "/message_attachments_files/";

    foreach ($attachments as $att) {
        
        $stored_name   = basename($att["stored_name"]);
        $original_name = $att["original_name"];
        $mime_type     = $att["mime_type"];
        $file_size     = (int)$att["file_size"];

        // Verify the file actually exists on disk
        if (!file_exists($uploadDir . $stored_name)) continue;

        // Rename to tie it to the real message_id
        $new_stored = "msg_{$message_id}_" . bin2hex(random_bytes(4)) . "_" . time() . ".bin";
        rename($uploadDir . $stored_name, $uploadDir . $new_stored);

        $att_stmt = $conn->prepare("
            INSERT INTO message_attachments (message_id, original_name, stored_name, mime_type, file_size)
            VALUES (?, ?, ?, ?, ?)
        ");
        $att_stmt->bind_param("isssi", $message_id, $original_name, $new_stored, $mime_type, $file_size);
        if (!$att_stmt->execute()) throw new Exception("Attachment insert failed");
        $att_stmt->close();
    }

    $conn->commit();
    exit(json_encode(["success" => true, "message_id" => $message_id]));

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    exit(json_encode(["error" => "Internal error: " . $e->getMessage()]));
} finally {
    $conn->close();
}
?>