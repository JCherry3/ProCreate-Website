<?php
session_start();
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    exit(json_encode(["error" => "Not authenticated. Please log in first."]));
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit(json_encode(["error" => "Method not allowed"]));
}

$input = json_decode(file_get_contents("php://input"), true);
$csrfToken = (string)($input['csrf_token'] ?? '');

if (!isset($_SESSION['csrf_token']) || !hash_equals((string)$_SESSION['csrf_token'], $csrfToken)) {
    http_response_code(403);
    exit(json_encode(["error" => "Invalid CSRF token"]));
}

$project_id = isset($input['project_id']) ? intval($input['project_id']) : 0;

if ($project_id <= 0) {
    http_response_code(400);
    exit(json_encode(["error" => "Project ID is required"]));
}

require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    exit(json_encode(["error" => "Database connection failed"]));
}

$sessionUserId = intval($_SESSION['user_id']);

$stmt = $conn->prepare("SELECT publisher_id, budget FROM project_requests WHERE project_id = ?");
$stmt->bind_param("i", $project_id);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    http_response_code(404);
    exit(json_encode(["error" => "Project request not found"]));
}

$row = $result->fetch_assoc();
$publisherId = isset($row['publisher_id']) ? intval($row['publisher_id']) : null;
$budget = isset($row['budget']) ? floatval($row['budget']) : 0;
$stmt->close();

if ($publisherId === null || $publisherId !== $sessionUserId) {
    http_response_code(403);
    exit(json_encode(["error" => "Only the request owner can delete this request"]));
}

$conn->begin_transaction();

$refund = $conn->prepare("UPDATE user_info SET balance = COALESCE(balance, 0) + ? WHERE user_id = ?");
if (!$refund) {
    $conn->rollback();
    http_response_code(500);
    exit(json_encode(["error" => "Failed to prepare wallet refund"]));
}
$refund->bind_param("di", $budget, $sessionUserId);
if (!$refund->execute() || $refund->affected_rows === 0) {
    $refund->close();
    $conn->rollback();
    http_response_code(500);
    exit(json_encode(["error" => "Failed to refund project budget"]));
}
$refund->close();

$del = $conn->prepare("DELETE FROM project_requests WHERE project_id = ?");
$del->bind_param("i", $project_id);
if (!$del->execute()) {
    $del->close();
    $conn->rollback();
    http_response_code(500);
    exit(json_encode(["error" => "Failed to delete project request"]));
}
$del->close();
$conn->commit();
$conn->close();

http_response_code(200);
echo json_encode([
    "success" => true,
    "message" => "Project request deleted",
    "project_id" => (string) $project_id,
    "refunded_budget" => $budget,
]);
