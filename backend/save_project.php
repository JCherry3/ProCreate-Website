<?php

session_start();
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once('config.php');

// DB connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    exit(json_encode(["error" => "Database connection failed"]));
}

// Get JSON input
$input = json_decode(file_get_contents("php://input"), true);
$projectId = $input['project_id'] ?? null;
$remove = $input['remove'] ?? false;

// Check if projectID is provided
if (is_null($projectId)) {
    http_response_code(400);
    exit(json_encode(["error" => "Project ID is required"]));
}

// Validate that $_SESSION['user_id']  and $_SESSION['auth_token'] are set
if (!isset($_SESSION['user_id']) || !isset($_SESSION['auth_token'])) {
    http_response_code(401);
    exit(json_encode(["error" => "Unauthorized: User not logged in"]));
}

// Verify that the project exists
$stmt = $conn->prepare("SELECT project_id FROM projects WHERE project_id = ?");
$stmt->bind_param("i", $projectId);
$stmt->execute();
$result = $stmt->get_result();
if ($result->num_rows === 0) {
    http_response_code(404);
    exit(json_encode(["error" => "Project not found"]));
}
$stmt->close();

$userId = $_SESSION['user_id'];

if ($remove) {
    // Check if project is saved
    $stmt = $conn->prepare("SELECT 1 FROM saved_projects WHERE project_id = ? AND user_id = ?");
    $stmt->bind_param("ii", $projectId, $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows === 0) {
        http_response_code(404);
        exit(json_encode(["error" => "Project not saved"]));
    }
    $stmt->close();

    // Delete from saved_projects
    $stmt = $conn->prepare("DELETE FROM saved_projects WHERE project_id = ? AND user_id = ?");
    $stmt->bind_param("ii", $projectId, $userId);
    if ($stmt->execute()) {
        http_response_code(200);
        echo json_encode(["success" => true, "message" => "Project unsaved successfully"]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Failed to unsave project"]);
    }
} else {
    // Insert into saved_projects (DB enforces uniqueness)
    $stmt = $conn->prepare("INSERT INTO saved_projects (project_id, user_id) VALUES (?, ?)");
    $stmt->bind_param("ii", $projectId, $userId);
    if ($stmt->execute()) {
        http_response_code(200);
        echo json_encode(["success" => true, "message" => "Project saved successfully"]);
    } else {
        // Check if it's a duplicate key error
        if ($conn->errno == 1062) { // Duplicate entry
            http_response_code(409);
            echo json_encode(["error" => "Project already saved"]);
        } else {
            http_response_code(500);
            echo json_encode(["error" => "Failed to save project"]);
        }
    }
}

$stmt->close();
$conn->close();