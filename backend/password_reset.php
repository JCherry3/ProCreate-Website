<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['email'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Email is required']);
    exit;
}

$email = filter_var($data['email'], FILTER_SANITIZE_EMAIL);

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid email format']);
    exit;
}

// Database connection
require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// Check if email exists in the database and retrieve the ID
$select = $conn->prepare('SELECT user_id FROM profile WHERE email = ?');
$select->bind_param('s', $email);
$select->execute();
$select->store_result();
if ($select->num_rows === 0) {
    http_response_code(404);
    echo json_encode(['error' => 'Email not found']);
    $select->close();
    $conn->close();
    exit;
}
// fetch the user_id for later use
$select->bind_result($user_id);
$select->fetch();
$select->close();

// Generate reset token
$reset_token = bin2hex(random_bytes(32));

// // Update profiles table with reset token
$stmt = $conn->prepare('UPDATE profile SET reset_token = ? WHERE email = ?');
$stmt->bind_param('ss', $reset_token, $email);

if (!$stmt->execute()) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to update reset token']);
    exit;
}

// Send email
// Build reset link using current request host and path (always HTTPS)
$protocol = 'https://';
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost';
// Determine current request directory and point to password_change.php in same directory
$request_path = isset($_SERVER['REQUEST_URI']) ? parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) : '';
$dir = $request_path ? rtrim(dirname($request_path), '/\\') : '';
if ($dir === '.' ) {
    $dir = '';
}
$reset_link = $protocol . $host . $dir . '/password_change.php?token=' . $reset_token . '&user_id=' . urlencode($user_id);
$subject = 'Password Reset Request';
$message = "Click the link below to reset your password:\n\n" . $reset_link;
$headers = "From: noreply@procreate.com";

if (mail($email, $subject, $message, $headers)) {
    http_response_code(200);
    echo json_encode(['message' => 'Password reset email sent']);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to send email']);
}

$stmt->close();
$conn->close();
?>