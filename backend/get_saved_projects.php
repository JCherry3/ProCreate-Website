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

// No JSON input

// Validate that $_SESSION['user_id']  and $_SESSION['auth_token'] are set
if (!isset($_SESSION['user_id']) || !isset($_SESSION['auth_token'])) {
    http_response_code(401);
    exit(json_encode(["error" => "Unauthorized: User not logged in"]));
}

// Get current user ID from session
$userId = intval($_SESSION['user_id']);

$sql = "
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
        pr.allow_comments,
        pr.enable_downloads,
        pr.date_posted,
        pr.date_updated,
        pr.likes,
        (SELECT COUNT(*) FROM feedback f WHERE f.project_id = pr.project_id) AS comment_count,
        p.`first name` AS first_name,
        p.`last name` AS last_name,
        p.username,
        lp.user_id IS NOT NULL AS is_liked,
        (SELECT COUNT(*) FROM feedback f WHERE f.project_id = pr.project_id) AS comment_count
    FROM projects pr
    INNER JOIN profile p 
        ON pr.publisher_id = p.user_id
    INNER JOIN saved_projects sp
        ON sp.project_id = pr.project_id AND sp.user_id = ?
    LEFT JOIN liked_projects lp
        ON lp.project_id = pr.project_id AND lp.user_id = ?
    ORDER BY pr.date_posted DESC
";

$stmt = $conn->prepare($sql);
if (!$stmt) {
    http_response_code(500);
    exit(json_encode(["error" => "Query preparation failed: " . $conn->error]));
}
$stmt->bind_param("ii", $userId, $userId);

$stmt->execute();

if ($stmt->error) {
    http_response_code(500);
    exit(json_encode(["error" => "Query execution failed: " . $stmt->error]));
}

$result = $stmt->get_result();

$projects = [];

while ($row = $result->fetch_assoc()) {
    // Parse image_urls and take a usable URL
    $imageUrl = "";
    if (!empty($row['image_urls'])) {
        $rawImage = $row['image_urls'];
        $decoded = json_decode($rawImage, true);

        if (json_last_error() === JSON_ERROR_NONE) {
            if (is_array($decoded)) {
                // If it's an indexed array, take the first element
                if (isset($decoded[0]) && is_string($decoded[0])) {
                    $imageUrl = $decoded[0];
                // If it's an associative array with a 'url' key
                } elseif (isset($decoded['url']) && is_string($decoded['url'])) {
                    $imageUrl = $decoded['url'];
                }
            } elseif (is_string($decoded)) {
                // JSON string value
                $imageUrl = $decoded;
            }
        } else {
            // Not valid JSON → treat as a plain URL string
            $imageUrl = $rawImage;
        }
    }

    $projects[] = [
        "id" => (string) $row['project_id'],
        "title" => $row['title'],
        "image" => $imageUrl,
        "author" => [
            "name" => trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? '')),
            "username" => $row['username'],
            "avatar" => ""
        ],
        "likes" => isset($row['likes']) ? (int) $row['likes'] : 0,
        "comments" => isset($row['comment_count']) ? (int) $row['comment_count'] : 0,
        "isLiked" => (bool) $row['is_liked'],
        "isSaved" => true,
        "category" => $row['category'],
        "description" => $row['description'],
        "tags" => $row['tags'],
        "difficulty" => $row['difficulty_level'],
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