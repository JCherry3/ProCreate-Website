<?php
// api/follow.php
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

// Auth check
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    exit(json_encode(["error" => "Not authenticated. Please log in first."]));
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
$action = trim($input['action'] ?? ''); // "follow" or "unfollow"

if (!$targetUsername || !in_array($action, ['follow', 'unfollow'], true)) {
    http_response_code(400);
    exit(json_encode(["error" => "Invalid request. Provide target_username and action."]));
}

// Find target user ID via profile table
$stmt = $conn->prepare("SELECT user_id FROM profile WHERE username = ? LIMIT 1");
$stmt->bind_param("s", $targetUsername);
$stmt->execute();
$res = $stmt->get_result();
$targetUser = $res->fetch_assoc();

if (!$targetUser) {
    http_response_code(404);
    exit(json_encode(["error" => "User not found"]));
}

$targetId = (int)$targetUser['user_id'];

if ($targetId === $currentUserId) {
    http_response_code(400);
    exit(json_encode(["error" => "You cannot follow yourself"]));
}

// -- Update TARGET user's followers list (JSON array) ----------------------
$stmt = $conn->prepare("SELECT followers FROM user_info WHERE user_id = ? LIMIT 1");
$stmt->bind_param("i", $targetId);
$stmt->execute();
$infoRes = $stmt->get_result();
$info = $infoRes->fetch_assoc();
$followers = json_decode($info['followers'] ?? '[]', true);
if (!is_array($followers)) $followers = [];

if ($action === 'follow') {
    if (!in_array($currentUserId, $followers, true)) {
        $followers[] = $currentUserId;
    }
} else {
    $followers = array_values(array_filter($followers, fn($id) => $id !== $currentUserId));
}

$newFollowersList = json_encode($followers);
$update = $conn->prepare("UPDATE user_info SET followers = ? WHERE user_id = ?");
$update->bind_param("si", $newFollowersList, $targetId);

if (!$update->execute()) {
    http_response_code(500);
    exit(json_encode(["error" => "Failed to update followers"]));
}

// -- Update CURRENT user's following count (integer) -----------------------
if ($action === 'follow') {
    $update2 = $conn->prepare("UPDATE user_info SET following = following + 1 WHERE user_id = ?");
} else {
    $update2 = $conn->prepare("UPDATE user_info SET following = GREATEST(0, following - 1) WHERE user_id = ?");
}
$update2->bind_param("i", $currentUserId);

if (!$update2->execute()) {
    http_response_code(500);
    exit(json_encode(["error" => "Failed to update following"]));
}

// Fetch updated following count to return
$stmt3 = $conn->prepare("SELECT following FROM user_info WHERE user_id = ? LIMIT 1");
$stmt3->bind_param("i", $currentUserId);
$stmt3->execute();
$followingCount = (int)$stmt3->get_result()->fetch_assoc()['following'];

// -- Return updated counts -------------------------------------------------
echo json_encode([
    "success"         => true,
    "action"          => $action,
    "follower_count"  => count($followers),
    "following_count" => $followingCount,
    "is_following"    => in_array($currentUserId, $followers, true)
]);

$conn->close();