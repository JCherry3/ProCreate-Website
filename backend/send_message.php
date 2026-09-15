<?php
// ------------------ HEADERS ------------------
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Handle preflight
if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit(json_encode(["success" => true]));
}

// Only allow POST
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    exit(json_encode(["error" => "Method not allowed"]));
}

// ------------------ SESSION & AUTH ------------------
session_start();

$user_id = isset($_SESSION["user_id"]) ? (int)$_SESSION["user_id"] : 0;

if ($user_id === 0) {
    http_response_code(401);
    exit(json_encode(["error" => "Not authenticated"]));
}

// ------------------ INPUT & LIMITS ------------------
define("MAX_SUBJECT_LENGTH", 255);
define("MAX_BODY_LENGTH", 1000);
define("MAX_ATTACHMENT_BYTES", 20 * 1024 * 1024); // 20 MB per file
define("MAX_ATTACHMENT_MB_LABEL", "20MB");

$recipient_id = isset($_POST["recipient_id"]) ? (int)$_POST["recipient_id"] : 0;
$body         = isset($_POST["body"]) ? trim($_POST["body"]) : "";
$subject      = (isset($_POST["subject"]) && trim($_POST["subject"]) !== "")
                ? trim($_POST["subject"])
                : "(no subject)";

$has_attachments = isset($_FILES['attachments']) && count(array_filter($_FILES['attachments']['name'])) > 0;

if ($recipient_id <= 0 || ($body === "" && !$has_attachments)) {
    http_response_code(400);
    exit(json_encode([
        "error" => "Recipient and either a message body or attachment are required",
        "debug_recipient" => $recipient_id,
        "debug_body" => $body,
        "debug_files" => $_FILES,
        "debug_post" => $_POST,
    ]));
}

if (mb_strlen($subject) > MAX_SUBJECT_LENGTH) {
    http_response_code(400);
    exit(json_encode(["error" => "Subject exceeds " . MAX_SUBJECT_LENGTH . " characters"]));
}

if (mb_strlen($body) > MAX_BODY_LENGTH) {
    http_response_code(400);
    exit(json_encode(["error" => "Message body exceeds " . MAX_BODY_LENGTH . " characters"]));
}

// ------------------ DB CONNECTION ------------------
require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

if ($conn->connect_error) {
    http_response_code(500);
    exit(json_encode(["error" => "Database connection failed"]));
}

// ------------------ ATTACHMENT ALLOWLISTS ------------------
$allowed_extensions = [
    // Images
    'jpg', 'jpeg', 'png', 'gif', 'webp',
    // Video
    'mp4', 'mov', 'avi', 'webm', 'mkv',
    // Audio
    'mp3', 'wav', 'ogg', 'aac', 'm4a',
];

$allowed_mimes = [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    // Video
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska',
    // Audio
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/mp4', 'audio/x-m4a',
];

try {
    $conn->begin_transaction();

    // 1. CHECK RECIPIENT
    $check = $conn->prepare("SELECT user_id FROM profile WHERE user_id = ? LIMIT 1");
    $check->bind_param("i", $recipient_id);
    $check->execute();
    if ($check->get_result()->num_rows === 0) {
        $conn->rollback();
        http_response_code(404);
        exit(json_encode(["error" => "Recipient not found"]));
    }
    $check->close();

    // 2. INSERT MESSAGE
    $stmt = $conn->prepare("
        INSERT INTO messages (sender_id, recipient_id, subject, body, sent_at, is_read)
        VALUES (?, ?, ?, ?, NOW(), 0)
    ");
    $stmt->bind_param("iiss", $user_id, $recipient_id, $subject, $body);

    if (!$stmt->execute()) {
        exit(json_encode(["error" => "Message Insert Failed"]));
        throw new Exception("Message insert failed");
    }
    $message_id = $stmt->insert_id;
    $stmt->close();

    // 3. HANDLE ATTACHMENTS
    $attachments_saved = 0;
    $warnings = [];

    if (isset($_FILES['attachments'])) {
        $subDir   = "message_attachments_files/";
        $uploadDir = __DIR__ . "/" . $subDir;

        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $files = $_FILES['attachments'];

        for ($i = 0; $i < count($files['name']); $i++) {
            $original_name = basename($files['name'][$i]);

            // Skip empty slots
            if ($files['name'][$i] === "") {
                continue;
            }

            // Handle upload errors
            if ($files['error'][$i] !== UPLOAD_ERR_OK) {
                // UPLOAD_ERR_INI_SIZE (1) or UPLOAD_ERR_FORM_SIZE (2) = too big at the PHP/form level
                if (in_array($files['error'][$i], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE])) {
                    $warnings[] = "\"$original_name\" was skipped — file exceeds the " . MAX_ATTACHMENT_MB_LABEL . " size limit.";
                } else {
                    $warnings[] = "\"$original_name\" could not be uploaded (upload error code {$files['error'][$i]}).";
                }
                continue;
            }

            $file_size = $files['size'][$i];
            $tmp_path  = $files['tmp_name'][$i];

            // Soft-warn and skip oversized files instead of hard-failing the whole request
            if ($file_size > MAX_ATTACHMENT_BYTES) {
                $actual_mb = round($file_size / 1024 / 1024, 1);
                $warnings[] = "\"$original_name\" was skipped — it is {$actual_mb}MB, which exceeds the " . MAX_ATTACHMENT_MB_LABEL . " limit per file.";
                continue;
            }

            // Detect real MIME from file content
            $real_mime = $finfo->file($tmp_path);

            // finfo can misdetect mp4/mov as octet-stream — fall back to extension-based mime
            $ext_mime_map = [
                'mp4'  => 'video/mp4',
                'mov'  => 'video/quicktime',
                'avi'  => 'video/x-msvideo',
                'webm' => 'video/webm',
                'mkv'  => 'video/x-matroska',
                'mp3'  => 'audio/mpeg',
                'wav'  => 'audio/wav',
                'ogg'  => 'audio/ogg',
                'aac'  => 'audio/aac',
                'm4a'  => 'audio/mp4',
            ];

            $extension = strtolower(pathinfo($original_name, PATHINFO_EXTENSION));

            if (!in_array($real_mime, $allowed_mimes, true)) {
                if (isset($ext_mime_map[$extension])) {
                    $real_mime = $ext_mime_map[$extension];
                } else {
                    $warnings[] = "\"$original_name\" was skipped — file type ($real_mime) is not allowed.";
                    continue;
                }
            }

            // Validate extension
            if (!in_array($extension, $allowed_extensions, true)) {
                $warnings[] = "\"$original_name\" was skipped — file extension (.$extension) is not allowed.";
                continue;
            }

            // Store with .bin so the file is never directly executable
            $stored_name = "msg_" . $message_id . "_" . bin2hex(random_bytes(4)) . "_" . time() . ".bin";
            $target_path = $uploadDir . $stored_name;

            if (move_uploaded_file($tmp_path, $target_path)) {
                chmod($target_path, 0644);

                $attach_stmt = $conn->prepare("
                    INSERT INTO message_attachments
                    (message_id, original_name, stored_name, mime_type, file_size)
                    VALUES (?, ?, ?, ?, ?)
                ");
                $attach_stmt->bind_param("isssi", $message_id, $original_name, $stored_name, $real_mime, $file_size);

                if (!$attach_stmt->execute()) {
                    throw new Exception("Attachment DB record failed");
                }
                $attach_stmt->close();
                $attachments_saved++;
            } else {
                $warnings[] = "\"$original_name\" could not be saved to disk.";
            }
        }
    }

    $conn->commit();

    $response = [
        "success"           => true,
        "message_id"        => $message_id,
        "attachments_count" => $attachments_saved,
    ];

    // Surface any per-file warnings to the client without failing the whole request
    if (!empty($warnings)) {
        $response["warnings"] = $warnings;
    }

    echo json_encode($response);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["error" => "An internal error occurred."]);
} finally {
    $conn->close();
}
?>