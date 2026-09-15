<?php
header('Content-Type: application/json');
session_start();

// ── Authorization check ────────────────────────────────────────────────────
if (!isset($_SESSION['user_id']) || !isset($_SESSION['auth_token'])) {
  http_response_code(401);
  echo json_encode(['error' => 'Unauthorized']);
  exit;
}

// ── Get JSON payload ──────────────────────────────────────────────────────
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['userid'])) {
  http_response_code(400);
  echo json_encode(['error' => 'Missing userid parameter']);
  exit;
}

$userid = intval($input['userid']);

// ── Database connection ────────────────────────────────────────────────────
require 'config.php';

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

if ($conn->connect_error) {
  http_response_code(500);
  echo json_encode(['error' => 'Database connection failed: ' . $conn->connect_error]);
  $conn->close();
  exit;
}

// ── Fetch skills for user ──────────────────────────────────────────────────
$sql = "SELECT skill FROM user_skills WHERE user_id = ? ORDER BY skill ASC";
$stmt = $conn->prepare($sql);

if (!$stmt) {
  http_response_code(500);
  echo json_encode(['error' => 'Database prepare failed: ' . $conn->error]);
  $conn->close();
  exit;
}

$stmt->bind_param("i", $userid);
$stmt->execute();
$result = $stmt->get_result();

$skills = [];
while ($row = $result->fetch_assoc()) {
  $skills[] = $row['skill'];
}

$stmt->close();
$conn->close();

// ── Return response ────────────────────────────────────────────────────────
http_response_code(200);
echo json_encode($skills);
?>
