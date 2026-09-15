<?php
session_start();
header("Content-Type: application/json");

// Check if user is authenticated
if (!isset($_SESSION['user_id'])) {
    http_response_code(400);
    echo json_encode(["error" => "Not logged in"]);
    exit;
}

// Destroy session data
session_destroy();

http_response_code(200);
echo json_encode(["message" => "Logged out successfully"]);
?>
