<?php
session_start();
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Database connection
require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed"]);
    exit;
}

$input = json_decode(file_get_contents("php://input"), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid input"]);
    exit;
}

$projectId = isset($input['project_id']) ? intval($input['project_id']) : null;
$action = isset($input['action']) ? $input['action'] : null;

$userId = isset($_SESSION['user_id']) ? intval($_SESSION['user_id']) : null;
if (!$userId) {
    http_response_code(401);
    echo json_encode(["error" => "User not authenticated"]);
    exit;
}

if (!$projectId || !in_array($action, ["like", "unlike"], true)) {
    http_response_code(400);
    echo json_encode(["error" => "Missing or invalid parameters"]);
    exit;
}

$conn->begin_transaction();

try {
    if ($action === "like") {
        // Insert into liked_projects (ignore if already exists)
        $sql = "INSERT IGNORE INTO liked_projects (project_id, user_id) VALUES (?, ?)";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("ii", $projectId, $userId);
        $stmt->execute();
        $stmt->close();

        // Increment likes
        $sql = "UPDATE projects SET likes = likes + 1 WHERE project_id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $projectId);
        $stmt->execute();
        $stmt->close();
    } else { // unlike
        // Delete from liked_projects
        $sql = "DELETE FROM liked_projects WHERE project_id = ? AND user_id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("ii", $projectId, $userId);
        $stmt->execute();
        $stmt->close();

        // Decrement likes, but not below 0
        $sql = "UPDATE projects SET likes = GREATEST(likes - 1, 0) WHERE project_id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $projectId);
        $stmt->execute();
        $stmt->close();
    }

    $conn->commit();

    // Get updated likes
    $sql = "SELECT likes FROM projects WHERE project_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $projectId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();

    if (!$row) {
        throw new Exception("Project not found");
    }

    http_response_code(200);
    echo json_encode(["likes" => (int)$row['likes']]);
} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["error" => "Transaction failed: " . $e->getMessage()]);
}

$conn->close();
