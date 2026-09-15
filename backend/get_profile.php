<?php
session_start();
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

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

$input = json_decode(file_get_contents("php://input"), true);
$user_id = null;
$username = null;

if (isset($input['username'])) {
    $username = $input['username'];
} elseif (isset($input['user_id'])) {
    $user_id = intval($input['user_id']);
} else {
    $user_id = intval($_SESSION['user_id']);
}

if ($username !== null) {
    $stmt = $conn->prepare("
        SELECT p.user_id, p.`first name` AS first_name, p.`last name` AS last_name,
            p.username, p.date, p.email, ui.location, ui.followers, ui.following,
            ui.bio, ui.company, ui.job as role, ui.website, ui.pic, ui.showEmail
        FROM profile p
        INNER JOIN user_info ui ON p.user_id = ui.user_id
        WHERE p.username = ? LIMIT 1
    ");
    $stmt->bind_param("s", $username);
} else {
    $stmt = $conn->prepare("
        SELECT p.user_id, p.`first name` AS first_name, p.`last name` AS last_name,
            p.username, p.date, p.email, ui.location, ui.followers, ui.following,
            ui.bio, ui.company, ui.job as role, ui.website, ui.pic, ui.showEmail
        FROM profile p
        INNER JOIN user_info ui ON p.user_id = ui.user_id
        WHERE p.user_id = ? LIMIT 1
    ");
    $stmt->bind_param("i", $user_id);
}

if (!$stmt) {
    http_response_code(500);
    exit(json_encode(["error" => "Query preparation failed: " . $conn->error]));
}

$stmt->execute();

if ($stmt->error) {
    http_response_code(500);
    exit(json_encode(["error" => "Query execution failed: " . $stmt->error]));
}

$result = $stmt->get_result();

if ($result->num_rows > 0) {
    $user = $result->fetch_assoc();

    // Decode followers JSON array and return count instead of raw array
    $followersDecoded = json_decode($user['followers'] ?? '[]', true);
    $user['followers'] = is_array($followersDecoded) ? count($followersDecoded) : 0;

    if (!empty($user['pic'])) {
        $user['pic'] = $user['pic'];
    }

    http_response_code(200);
    echo json_encode($user);
} else {
    http_response_code(404);
    echo json_encode(["error" => "User not found"]);
}

$stmt->close();
$conn->close();