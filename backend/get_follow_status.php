<?php
// api/get_follow_status.php
session_start();
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    exit(json_encode(["error" => "Not authenticated."]));
}

require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    exit(json_encode(["error" => "Database connection failed"]));
}

$currentUserId = (int)$_SESSION['user_id'];
$input = json_decode(file_get_contents("php://input"), true);
$targetUsername = trim($input['target_username'] ?? '');

if (!$targetUsername) {
    http_response_code(400);
    exit(json_encode(["error" => "target_username is required"]));
}

// Join profile and user_info to get follower list by username
$stmt = $conn->prepare("
    SELECT ui.followers 
    FROM profile p
    INNER JOIN user_info ui ON p.user_id = ui.user_id
    WHERE p.username = ? LIMIT 1
");
$stmt->bind_param("s", $targetUsername);
$stmt->execute();
$result = $stmt->get_result();

if ($user = $result->fetch_assoc()) {
    $followers = json_decode($user['followers'] ?? '[]', true);
    if (!is_array($followers)) $followers = [];

    echo json_encode([
        "is_following" => in_array($currentUserId, $followers, true),
        "follower_count" => count($followers)
    ]);
} else {
    http_response_code(404);
    echo json_encode(["error" => "User not found"]);
}

$conn->close();