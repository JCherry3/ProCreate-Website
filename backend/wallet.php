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

if (!isset($_SESSION['auth_token']) || !isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(["error" => "Not authenticated. Please log in first."]);
    exit;
}

$input = json_decode(file_get_contents("php://input"), true);

$csrfToken = $input['csrf_token'] ?? '';
if (!isset($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $csrfToken)) {
    http_response_code(403);
    echo json_encode(["error" => "Invalid CSRF token"]);
    $conn->close();
    exit;
}

$user_id = $_SESSION['user_id'];
$amount = isset($input['amount']) ? intval($input['amount']) : null;
$MAX_WALLET = 1000000000;

$stmt = $conn->prepare("
    SELECT u.balance AS balance
    FROM user_info u
    WHERE user_id = ?
");
$stmt->bind_param("i", $user_id);

if (!$stmt) {
    http_response_code(500);
    exit(json_encode(["error" => "Query preparation failed: " . $conn->error]));
}

$stmt->execute();

if ($stmt->error) {
    http_response_code(500);
    exit(json_encode(["error" => "Query execution failed: " . $stmt->error]));
}

$result = $stmt->get_result();
$row = $result->fetch_assoc();
$currentBalance = intval($row['balance']);

$stmt->close();

if($amount == null) {
    http_response_code(200);
    echo json_encode(["balance" => intval($currentBalance)]);
    $conn->close();
    exit;
} else {
    $newbalance = intval($currentBalance) + $amount;

    // Prevent negative balance
    if ($newbalance < 0) {
        http_response_code(400);
        echo json_encode(["error" => "Insufficient funds"]);
        $conn->close();
        exit;
    }

    // Prevent exceeding max balance
    if ($newbalance > $MAX_WALLET) {
        http_response_code(400);
        echo json_encode(["error" => "Exceeds maximum wallet balance"]);
        $conn->close();
        exit;
    }

    $stmt_info = $conn->prepare("UPDATE user_info SET balance = ? WHERE user_id = ?");
    $stmt_info->bind_param("ii", $newbalance, $user_id);
    if (!$stmt_info->execute()) {
        $conn->rollback();
        http_response_code(500);
        echo json_encode(["error" => "Failed to fetch wallet balance: " . $stmt_info->error]);
        $stmt_info->close();
        $conn->close();
        exit;
    }
    $conn->commit();
    echo json_encode(["balance" => $newbalance]);
    $stmt_info->close();
    $conn->close();
    exit;
}
