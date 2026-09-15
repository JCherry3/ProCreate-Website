<?php
session_start();
header("Content-Type: application/json");

// Database connection
require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed"]);
    exit;
}

// Get JSON input
$input = json_decode(file_get_contents("php://input"), true);

// Check auth
if (!isset($_SESSION['auth_token']) || !isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(["error" => "Not authenticated. Please log in first."]);
    exit;
}

$csrfToken = $input['csrf_token'] ?? '';
if (!isset($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $csrfToken)) {
    http_response_code(403);
    echo json_encode(["error" => "Invalid CSRF token"]);
    $conn->close();
    exit;
}

$publisherId   = intval($_SESSION['user_id']);
$projectTitle  = trim(strval($input['project_title'] ?? $input['title'] ?? ''));
$category      = trim(strval($input['category'] ?? ''));
$description   = trim(strval($input['description'] ?? ''));
$budgetRaw     = trim(strval($input['budget'] ?? ''));
$deadline      = trim(strval($input['deadline'] ?? ''));
$dateOfRequest = trim(strval($input['date_of_request'] ?? $input['dateOfRequest'] ?? date('Y-m-d')));
$projectType   = trim(strval($input['project_type'] ?? $input['projectType'] ?? 'individual'));
$rolesInput    = $input['roles'] ?? null;

if ($projectTitle === '' || $category === '' || $description === '' || $budgetRaw === '' || $deadline === '') {
    http_response_code(400);
    echo json_encode(["error" => "title, category, description, budget, and deadline are required"]);
    $conn->close();
    exit;
}

$budgetSanitized = preg_replace('/[^0-9.\-]/', '', $budgetRaw);
if (!is_numeric($budgetSanitized)) {
    http_response_code(400);
    echo json_encode(["error" => "Budget must be a number"]);
    $conn->close();
    exit;
}
$budget = floatval($budgetSanitized);
if ($budget <= 0) {
    http_response_code(400);
    echo json_encode(["error" => "Budget must be greater than 0"]);
    $conn->close();
    exit;
}

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $deadline) || !strtotime($deadline)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid deadline date"]);
    $conn->close();
    exit;
}

if (strtotime($deadline) < strtotime(date('Y-m-d'))) {
    http_response_code(400);
    echo json_encode(["error" => "Deadline cannot be in the past"]);
    $conn->close();
    exit;
}

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateOfRequest) || !strtotime($dateOfRequest)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid date_of_request"]);
    $conn->close();
    exit;
}

$projectType = strtolower($projectType) === 'group' ? 'group' : 'individual';
$roles = [];

if ($projectType === 'group') {
    if (!is_array($rolesInput) || count($rolesInput) === 0) {
        http_response_code(400);
        echo json_encode(["error" => "roles are required for group project requests"]);
        $conn->close();
        exit;
    }

    foreach ($rolesInput as $index => $roleItem) {
        if (!is_array($roleItem)) {
            http_response_code(400);
            echo json_encode(["error" => "Each role entry must be an object with role and count"]);
            $conn->close();
            exit;
        }
        $roleName = trim(strval($roleItem['role'] ?? ''));
        $count    = intval($roleItem['count'] ?? 0);

        if ($roleName === '' || $count < 1) {
            http_response_code(400);
            echo json_encode(["error" => "Each role entry must include a non-empty role name and a count of at least 1"]);
            $conn->close();
            exit;
        }

        $roles[] = [
            'role'  => $roleName,
            'count' => $count,
        ];
    }
}

$conn->query("CREATE TABLE IF NOT EXISTS project_request_roles (
    role_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    role_name VARCHAR(100) NOT NULL,
    slot_index INT NOT NULL,
    status ENUM('open','filled','completed') NOT NULL DEFAULT 'open',
    assigned_user_id INT DEFAULT NULL,
    assigned_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_project_id (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci");

$conn->begin_transaction();

$balanceStmt = $conn->prepare("SELECT COALESCE(balance, 0) AS balance FROM user_info WHERE user_id = ?");
if (!$balanceStmt) {
    http_response_code(500);
    echo json_encode(["error" => "Failed to prepare balance lookup: " . $conn->error]);
    $conn->close();
    exit;
}
$balanceStmt->bind_param("i", $publisherId);
$balanceStmt->execute();
$balanceResult = $balanceStmt->get_result();
$balanceRow = $balanceResult ? $balanceResult->fetch_assoc() : null;
$balanceStmt->close();

if (!$balanceRow) {
    $conn->rollback();
    http_response_code(404);
    echo json_encode(["error" => "User wallet not found"]);
    $conn->close();
    exit;
}

$currentBalance = floatval($balanceRow['balance']);
if ($currentBalance < $budget) {
    $conn->rollback();
    http_response_code(400);
    echo json_encode(["error" => "Insufficient funds"]);
    $conn->close();
    exit;
}

$deductStmt = $conn->prepare("UPDATE user_info SET balance = COALESCE(balance, 0) - ? WHERE user_id = ?");
if (!$deductStmt) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["error" => "Failed to prepare wallet update: " . $conn->error]);
    $conn->close();
    exit;
}
$deductStmt->bind_param("di", $budget, $publisherId);
if (!$deductStmt->execute() || $deductStmt->affected_rows === 0) {
    $deductStmt->close();
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["error" => "Failed to deduct project budget from wallet"]);
    $conn->close();
    exit;
}
$deductStmt->close();

$stmt = $conn->prepare(
    "INSERT INTO project_requests
     (publisher_id, project_title, category, description, budget, deadline, date_of_request, project_type, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
);
if (!$stmt) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["error" => "Failed to prepare request insert: " . $conn->error]);
    $conn->close();
    exit;
}

$status = 'pending';
$stmt->bind_param(
    "isssdssss",
    $publisherId,
    $projectTitle,
    $category,
    $description,
    $budget,
    $deadline,
    $dateOfRequest,
    $projectType,
    $status
);

if ($stmt->execute()) {
    $requestId = $stmt->insert_id;

    if ($projectType === 'group') {
        $slotStmt = $conn->prepare(
            "INSERT INTO project_request_roles (project_id, role_name, slot_index, status) VALUES (?, ?, ?, 'open')"
        );
        if (!$slotStmt) {
            $conn->rollback();
            http_response_code(500);
            echo json_encode(["error" => "Failed to prepare role insert: " . $conn->error]);
            $stmt->close();
            $conn->close();
            exit;
        }

        foreach ($roles as $roleEntry) {
            for ($i = 1; $i <= $roleEntry['count']; $i++) {
                $slotStmt->bind_param("isi", $requestId, $roleEntry['role'], $i);
                if (!$slotStmt->execute()) {
                    $conn->rollback();
                    http_response_code(500);
                    echo json_encode(["error" => "Failed to save role slots"]);
                    $slotStmt->close();
                    $stmt->close();
                    $conn->close();
                    exit;
                }
            }
        }

        $slotStmt->close();
    }

    $conn->commit();
    http_response_code(201);
    echo json_encode([
        "message" => "Project request created successfully",
        "request_id" => $requestId,
        "project_type" => $projectType,
        "status" => $status,
        "remaining_balance" => $currentBalance - $budget,
    ]);
} else {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["error" => "Creation of project request failed"]);
}

$stmt->close();
$conn->close();
