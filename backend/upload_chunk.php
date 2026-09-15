<?php
header("Content-Type: application/json");
session_start();

$user_id = isset($_SESSION["user_id"]) ? (int)$_SESSION["user_id"] : 0;
if ($user_id === 0) {
    http_response_code(401);
    exit(json_encode(["error" => "Not authenticated"]));
}

ini_set('upload_max_filesize', '3M');
ini_set('post_max_size', '4M');

$upload_id    = isset($_POST["upload_id"])    ? preg_replace('/[^a-f0-9]/', '', $_POST["upload_id"]) : "";
$chunk_index  = isset($_POST["chunk_index"])  ? (int)$_POST["chunk_index"] : -1;
$total_chunks = isset($_POST["total_chunks"]) ? (int)$_POST["total_chunks"] : -1;
$original_name = isset($_POST["original_name"]) ? basename($_POST["original_name"]) : "";

if (!$upload_id || $chunk_index < 0 || $total_chunks <= 0 || !$original_name) {
    http_response_code(400);
    exit(json_encode(["error" => "Missing chunk metadata"]));
}

$total_size = isset($_POST["total_size"]) ? (int)$_POST["total_size"] : 0;
if ($total_size > 50 * 1024 * 1024) {
    http_response_code(400);
    exit(json_encode(["error" => "File exceeds the 50MB limit."]));
}

if (!isset($_FILES["chunk"]) || $_FILES["chunk"]["error"] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    exit(json_encode(["error" => "Chunk upload failed", "code" => $_FILES["chunk"]["error"] ?? -1]));
}

$tmp_dir = __DIR__ . "/chunk_tmp/{$upload_id}/";
if (!is_dir($tmp_dir)) mkdir($tmp_dir, 0755, true);

$chunk_path = $tmp_dir . "chunk_{$chunk_index}.bin";
move_uploaded_file($_FILES["chunk"]["tmp_name"], $chunk_path);

// Check if all chunks are present
$all_present = true;
for ($i = 0; $i < $total_chunks; $i++) {
    if (!file_exists($tmp_dir . "chunk_{$i}.bin")) {
        $all_present = false;
        break;
    }
}

if (!$all_present) {
    exit(json_encode(["success" => true, "assembled" => false]));
}

// Assemble
$allowed_mimes = [
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/mp4', 'audio/x-m4a',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
];

$subDir    = "message_attachments_files/";
$uploadDir = __DIR__ . "/" . $subDir;
if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

$stored_name  = "msg_chunk_" . $upload_id . "_" . time() . ".bin";
$target_path  = $uploadDir . $stored_name;
$out          = fopen($target_path, 'wb');

for ($i = 0; $i < $total_chunks; $i++) {
    $chunk_file = $tmp_dir . "chunk_{$i}.bin";
    $in = fopen($chunk_file, 'rb');
    while (!feof($in)) {
        fwrite($out, fread($in, 8192));
    }
    fclose($in);
    unlink($chunk_file);
}
fclose($out);
rmdir($tmp_dir);
chmod($target_path, 0644);

// Validate assembled MIME
$finfo     = new finfo(FILEINFO_MIME_TYPE);
$real_mime = $finfo->file($target_path);

$ext_mime_map = [
    'mp4' => 'video/mp4', 'mov' => 'video/quicktime', 'avi' => 'video/x-msvideo',
    'webm' => 'video/webm', 'mkv' => 'video/x-matroska',
    'mp3' => 'audio/mpeg', 'wav' => 'audio/wav', 'ogg' => 'audio/ogg',
    'aac' => 'audio/aac', 'm4a' => 'audio/mp4',
];
$extension = strtolower(pathinfo($original_name, PATHINFO_EXTENSION));
if (!in_array($real_mime, $allowed_mimes, true) && isset($ext_mime_map[$extension])) {
    $real_mime = $ext_mime_map[$extension];
}

if (!in_array($real_mime, $allowed_mimes, true)) {
    unlink($target_path);
    http_response_code(400);
    exit(json_encode(["error" => "File type not allowed: $real_mime"]));
}

exit(json_encode([
    "success"       => true,
    "assembled"     => true,
    "stored_name"   => $stored_name,
    "original_name" => $original_name,
    "mime_type"     => $real_mime,
    "file_size"     => filesize($target_path),
]));
?>