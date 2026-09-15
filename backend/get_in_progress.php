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

// Read JSON input (reserved for future filters like search/category)
$input = json_decode(file_get_contents("php://input"), true);
if (!is_array($input)) {
    $input = [];
}

// Optional project_id parameter to get a specific project
$project_id = isset($input['project_id']) ? intval($input['project_id']) : null;

// Optional limit on number of projects to return
$limit = isset($input['limit']) ? intval($input['limit']) : null;
$shared_mode = isset($input['shared_mode']) ? strtolower(trim(strval($input['shared_mode']))) : 'personal';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(["error" => "Not authenticated. Please log in first."]);
    $conn->close();
    exit;
}

$session_user_id = intval($_SESSION['user_id']);

$conn->query(
    "CREATE TABLE IF NOT EXISTS shared_draft_members (\n" .
    "    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,\n" .
    "    draft_id INT NOT NULL,\n" .
    "    user_id INT NOT NULL,\n" .
    "    project_request_id INT DEFAULT NULL,\n" .
    "    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n" .
    "    UNIQUE KEY uniq_draft_user (draft_id, user_id),\n" .
    "    INDEX idx_user (user_id),\n" .
    "    INDEX idx_project_request (project_request_id)\n" .
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci"
);

$baseSql = "
    SELECT
        pr.project_id,
        pr.title,
        pr.description,
        pr.category,
        pr.tags,
        pr.difficulty_level,
        pr.materials_used,
        pr.software_used,
        pr.image_urls,
        pr.likes,
        pr.allow_comments,
        pr.enable_downloads,
        pr.date_posted,
        pr.date_updated,
        p.`first name` AS first_name,
        p.`last name` AS last_name,
        p.username
    FROM in_progress pr
    INNER JOIN profile p
        ON pr.publisher_id = p.user_id
";

// Add WHERE clause based on filters
$whereConditions = [];
if ($project_id !== null) {
    $whereConditions[] = "pr.project_id = " . intval($project_id);
    $whereConditions[] =
        "(pr.publisher_id = " . $session_user_id . " OR EXISTS (SELECT 1 FROM shared_draft_members sdm WHERE sdm.draft_id = pr.project_id AND sdm.user_id = " . $session_user_id . "))";
} elseif ($shared_mode === 'shared') {
    $whereConditions[] =
        "EXISTS (SELECT 1 FROM shared_draft_members sdm WHERE sdm.draft_id = pr.project_id AND sdm.user_id = " . $session_user_id . ")";
} else {
    $whereConditions[] = "pr.publisher_id = " . $session_user_id;
}

if (!empty($whereConditions)) {
    $baseSql .= " WHERE " . implode(" AND ", $whereConditions);
}

$baseSql .= " ORDER BY pr.date_posted DESC";

if ($limit !== null && $limit > 0) {
    $sql = $baseSql . " LIMIT " . intval($limit);
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        http_response_code(500);
        exit(json_encode(["error" => "Query preparation failed: " . $conn->error]));
    }
} else {
    $stmt = $conn->prepare($baseSql);
    if (!$stmt) {
        http_response_code(500);
        exit(json_encode(["error" => "Query preparation failed: " . $conn->error]));
    }
}

$stmt->execute();

if ($stmt->error) {
    http_response_code(500);
    exit(json_encode(["error" => "Query execution failed: " . $stmt->error]));
}

$result = $stmt->get_result();

$projects = [];

while ($row = $result->fetch_assoc()) {
    // Parse image_urls and keep both the first image and full image list
    $imageUrl = "";
    $imageList = [];
    if (!empty($row['image_urls'])) {
        $rawImage = $row['image_urls'];
        $decoded = json_decode($rawImage, true);

        if (json_last_error() === JSON_ERROR_NONE) {
            if (is_array($decoded)) {
                $imageList = array_values(array_filter($decoded, 'is_string'));
                // If it's an indexed array, take the first element
                if (isset($decoded[0]) && is_string($decoded[0])) {
                    $imageUrl = $decoded[0];
                // If it's an associative array with a 'url' key
                } elseif (isset($decoded['url']) && is_string($decoded['url'])) {
                    $imageUrl = $decoded['url'];
                    $imageList = [$decoded['url']];
                }
            } elseif (is_string($decoded)) {
                // JSON string value
                $imageUrl = $decoded;
                $imageList = [$decoded];
            }
        } else {
            // Not valid JSON → treat as a plain URL string
            $imageUrl = $rawImage;
            $imageList = [$rawImage];
        }
    }

    $projects[] = [
        "id" => (string) $row['project_id'],
        "title" => $row['title'],
        "image" => $imageUrl,
        "images" => $imageList,
        "author" => [
            "name" => trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? '')),
            "username" => $row['username'],
            "avatar" => ""
        ],
        // These can later be wired to real data (likes/comments tables)
        "likes" => $row['likes'],
        "comments" => 0,
        "category" => $row['category'],
        "description" => $row['description'],
        "tags" => $row['tags'],
        "difficulty" => $row['difficulty_level'],
        "difficulty_level" => $row['difficulty_level'],
        "materials_used" => $row['materials_used'],
        "software_used" => $row['software_used'],
        "allow_comments" => (int) $row['allow_comments'],
        "enable_downloads" => (int) $row['enable_downloads'],
        "date_posted" => $row['date_posted'],
        "date_updated" => $row['date_updated'],
    ];
}

http_response_code(200);
echo json_encode($projects);

$stmt->close();
$conn->close();


