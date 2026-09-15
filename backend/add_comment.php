<?php
session_start();
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// load shared database connection (db.php sets $conn)
require_once __DIR__ . '/db.php';

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    exit(json_encode(["error" => "User not authenticated"]));
}

$user_id = $_SESSION['user_id'];

// Read JSON input
$input = json_decode(file_get_contents("php://input"), true);
$project_id = isset($input['project_id']) ? intval($input['project_id']) : null;
$feedback_text = trim($input['feedback_text'] ?? '');

if (!$project_id || empty($feedback_text)) {
    http_response_code(400);
    exit(json_encode(["error" => "Project ID and feedback text are required"]));
}

if (strlen($feedback_text) > 100) {
    http_response_code(400);
    exit(json_encode(["error" => "Feedback text must be 100 characters or less"]));
}

// Insert comment
$sql = "INSERT INTO feedback (project_id, user_id, feedback_text, date) VALUES (?, ?, ?, ?)";
$stmt = $conn->prepare($sql);
if (!$stmt) {
    http_response_code(500);
    exit(json_encode(["error" => "Query preparation failed: " . $conn->error]));
}

$date = time(); // Current timestamp
$stmt->bind_param("iisi", $project_id, $user_id, $feedback_text, $date);

if (!$stmt->execute()) {
    http_response_code(500);
    exit(json_encode(["error" => "Failed to add comment: " . $stmt->error]));
}

$feedback_id = $conn->insert_id;

http_response_code(201);
echo json_encode([
    "message" => "Comment added successfully",
    "feedback_id" => $feedback_id
]);

$stmt->close();
$conn->close();
?>