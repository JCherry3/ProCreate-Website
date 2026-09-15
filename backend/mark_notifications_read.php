<?php
session_start();
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    exit(json_encode(["error" => "Not authenticated"]));
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    exit(json_encode(["error" => "Database connection failed"]));
}

$userId = intval($_SESSION['user_id']);
$input  = json_decode(file_get_contents("php://input"), true);

// Accept either a specific array of IDs or "all"
$ids = $input['ids'] ?? null;   // array of int IDs, or null
$all = $input['all'] ?? false;  // true = mark every unread notification for this user

if ($all) {
    $stmt = $conn->prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();
    echo json_encode(["success" => true, "updated" => $affected]);
} elseif (is_array($ids) && count($ids) > 0) {
    // Build safe IN clause — only mark notifications that belong to this user
    $placeholders = implode(",", array_fill(0, count($ids), "?"));
    $types        = str_repeat("i", count($ids) + 1); // +1 for user_id
    $params       = array_merge([$userId], array_map('intval', $ids));

    $stmt = $conn->prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id IN ($placeholders) AND is_read = 0");
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();
    echo json_encode(["success" => true, "updated" => $affected]);
} else {
    http_response_code(400);
    echo json_encode(["error" => "Provide 'ids' array or 'all': true"]);
}

$conn->close();
?>
