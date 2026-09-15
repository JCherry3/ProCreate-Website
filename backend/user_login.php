<?php
session_start();
header("Content-Type: application/json");

error_reporting(E_ALL);
ini_set('display_errors', 1);

// DB connection
require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    exit(json_encode(["error" => "Database connection failed"]));
}

// Get JSON input
$input = json_decode(file_get_contents("php://input"), true);

$email = $input['email'] ?? '';
$password = $input['password'] ?? '';

if (empty($email) || empty($password)) {
    http_response_code(400);
    exit(json_encode(["error" => "Email and password are required"]));
}

// Look up user
$stmt = $conn->prepare("SELECT user_id, password FROM profile WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    http_response_code(404);
    exit(json_encode(["error" => "User not found"]));
}

$user = $result->fetch_assoc();

// Verify password
if (!password_verify($password, $user['password'])) {
    http_response_code(401);
    exit(json_encode(["error" => "Invalid password"]));
}

// Password is correct → generate new integer auth token (DB expects INT)
// Use a large positive integer within 32-bit signed range
$authToken = random_int(1000000000, 2147483647);

// Update token in DB (both auth_token and user_id are integers)
$stmtUpdate = $conn->prepare("UPDATE profile SET auth_token = ? WHERE user_id = ?");
$stmtUpdate->bind_param("ii", $authToken, $user['user_id']);
$stmtUpdate->execute();

// Store auth token and user_id in session
$_SESSION['auth_token'] = $authToken;
$_SESSION['csrf_token'] = bin2hex(random_bytes(32)); // Generate CSRF token for future requests
$_SESSION['user_id'] = $user['user_id'];

// Return only success message (token is stored in session, not sent to client)
http_response_code(200);
echo json_encode([
    "user_id" => $user['user_id'],
    "message" => "Login successful"
]);

$stmt->close();
$stmtUpdate->close();
$conn->close();