<?php
header('Content-Type: application/json');
session_start();

// ── Authorization check ────────────────────────────────────────────────────
if (!isset($_SESSION['user_id']) || !isset($_SESSION['auth_token'])) {
  http_response_code(401);
  echo json_encode(['error' => 'Unauthorized']);
  exit;
}

$user_id = $_SESSION['user_id'];
$auth_token = $_SESSION['auth_token'];

// ── Get JSON payload ──────────────────────────────────────────────────────
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['skills']) || !is_array($input['skills'])) {
  http_response_code(400);
  echo json_encode(['error' => 'Invalid payload: skills must be an array']);
  exit;
}

$skills = $input['skills'];

if (empty($skills)) {
  http_response_code(400);
  echo json_encode(['error' => 'Skills array cannot be empty']);
  exit;
}

// ── Database connection ────────────────────────────────────────────────────
require 'config.php';

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

if ($conn->connect_error) {
  http_response_code(500);
  echo json_encode(['error' => 'Database connection failed: ' . $conn->connect_error]);
  exit;
}

// ── Add skills to user_skills table ────────────────────────────────────────
$added_count = 0;
$errors = [];

foreach ($skills as $skill) {
  $skill = trim($skill);

  if (empty($skill)) {
    $errors[] = 'Empty skill string provided';
    continue;
  }

  $sql = "INSERT INTO user_skills (user_id, skill) VALUES (?, ?)";
  $stmt = $conn->prepare($sql);

  if (!$stmt) {
    $errors[] = 'Database prepare failed: ' . $conn->error;
    continue;
  }

  $stmt->bind_param("is", $user_id, $skill);

  if (!$stmt->execute()) {
    $errors[] = 'Failed to add skill "' . $skill . '": ' . $stmt->error;
  } else {
    $added_count++;
  }

  $stmt->close();
}

$conn->close();

// ── Return response ────────────────────────────────────────────────────────
http_response_code(200);
echo json_encode([
  'success' => true,
  'added_count' => $added_count,
  'total_skills' => count($skills),
  'errors' => $errors
]);
?>
