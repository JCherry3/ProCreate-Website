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

// Read JSON input
$input = json_decode(file_get_contents("php://input"), true);
$project_id = isset($input['project_id']) ? intval($input['project_id']) : null;

if (!$project_id) {
    http_response_code(400);
    exit(json_encode(["error" => "Project ID is required"]));
}

$sql = "
    SELECT 
        f.feedback_id,
        f.feedback_text,
        f.date,
        p.username,
        p.`first name` AS first_name,
        p.`last name` AS last_name
    FROM feedback f
    INNER JOIN profile p ON f.user_id = p.user_id
    WHERE f.project_id = ?
    ORDER BY f.date DESC
";

$stmt = $conn->prepare($sql);
if (!$stmt) {
    http_response_code(500);
    exit(json_encode(["error" => "Query preparation failed: " . $conn->error]));
}

$stmt->bind_param("i", $project_id);
$stmt->execute();

if ($stmt->error) {
    http_response_code(500);
    exit(json_encode(["error" => "Query execution failed: " . $stmt->error]));
}

$result = $stmt->get_result();

$comments = [];

while ($row = $result->fetch_assoc()) {
    $comments[] = [
        "id" => (string) $row['feedback_id'],
        "content" => $row['feedback_text'],
        "timestamp" => date('M j, Y g:i A', $row['date']), // Format timestamp
        "author" => trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? '')),
        "username" => $row['username']
    ];
}

http_response_code(200);
echo json_encode($comments);

$stmt->close();
$conn->close();
?>