<?php
// ------------------ DEBUG ------------------
ini_set('display_errors', 1);
error_reporting(E_ALL);

// ------------------ HEADERS ------------------
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Preflight
if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

// ------------------ SESSION ------------------
session_start();

// ------------------ DB CONNECTION ------------------
require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed"]);
    exit;
}

// ------------------ INPUT ------------------
$body = file_get_contents("php://input");
$data = json_decode($body, true);

$queryInput = isset($data["query"]) ? trim($data["query"]) : "";
$exact = isset($data["exact"]) && $data["exact"] === true;
$current_user_id = isset($_SESSION["user_id"]) ? (int)$_SESSION["user_id"] : 0;

if (empty($queryInput)) {
    echo json_encode(["users" => []]);
    exit;
}

// ------------------ THE QUERY ------------------
$base_sql = "
    SELECT 
        p.user_id AS id, 
        p.username, 
        CONCAT(p.`first name`, ' ', p.`last name`) AS display_name, 
        ui.pic
    FROM profile p
    LEFT JOIN user_info ui ON p.user_id = ui.user_id
    WHERE ";

if ($exact) {
    $sql = $base_sql . "p.username = ? AND p.user_id != ? LIMIT 1";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("si", $queryInput, $current_user_id);
} else {
    $searchTerm = $queryInput . "%";
    $sql = $base_sql . "
        (p.username LIKE ? OR p.`first name` LIKE ? OR p.`last name` LIKE ?)
        AND p.user_id != ?
        ORDER BY 
            CASE WHEN p.username LIKE ? THEN 0 ELSE 1 END, 
            p.username ASC
        LIMIT 8";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("sssis", $searchTerm, $searchTerm, $searchTerm, $current_user_id, $searchTerm);
}

$stmt->execute();
$result = $stmt->get_result();
$users = [];

// ------------------ SIMPLIFIED OUTPUT LOGIC ------------------
while ($u = $result->fetch_assoc()) {
    // Just like your first script: take the raw path or null if empty
    $rawPic = $u["pic"];
    
    $users[] = [
        "id"           => (int)$u["id"],
        "username"     => trim($u["username"]),
        "display_name" => trim($u["display_name"]),
        "pic"          => !empty($rawPic) ? $rawPic : null,
    ];
}

echo json_encode(["users" => $users]);

$stmt->close();
$conn->close();