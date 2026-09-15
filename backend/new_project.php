<?php
session_start();
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Database connection
require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    exit(json_encode(["error" => "Database connection failed"]));
}

// Read JSON input
$input = json_decode(file_get_contents("php://input"), true);

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    exit(json_encode(["error" => "Not authenticated. Please log in first."]));
}

// Validate required fields
$required_fields = ['title', 'description', 'category', 'allow_comments', 'difficulty_level', 'enable_downloads'];
foreach ($required_fields as $field) {
    if (!isset($input[$field])) {
        http_response_code(400);
        echo json_encode(["error" => "Missing required field: $field"]);
        $conn->close();
        exit();
    }
}

session_start();
$csrfToken = $input['csrf_token'] ?? '';
if (!isset($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $csrfToken)) {
    http_response_code(403);
    echo json_encode(["error" => "Invalid CSRF token"]);
    $conn->close();
    exit();
}

$publisher_id = intval($_SESSION['user_id']);
$title = $input['title'];
$description = $input['description'];
$category = $input['category'];
$tags = $input['tags'] ?? null;
$materials_used = $input['materials_used'] ?? null;
$software_used = $input['software_used'] ?? null;
$difficulty_level = $input['difficulty_level'];
$allow_comments = intval($input['allow_comments']);
$enable_downloads = intval($input['enable_downloads']);
$images = $input['images'];
$image_paths = [];
$draft = isset($input['draft']) ? intval($input['draft']) : 0;

// check if publisher ID is equal to user id stored in session and auth token is set (security check)
if (!isset($_SESSION['auth_token']) || !isset($_SESSION['user_id']) || $_SESSION['user_id'] !== $publisher_id) {
    http_response_code(403);
    echo json_encode(["error" => "Unauthorized: Publisher ID does not match logged-in user"]);
    $conn->close();
    exit();
}

//

for ($i = 0; $i < count($images); $i++) {
    if (!empty($images[$i]) && strpos($images[$i], 'data:image') === 0) {
        
        $imageParts = explode(";base64,", $images[$i]);

        if (count($imageParts) === 2) {

            $imageBase64 = base64_decode($imageParts[1]);

            // Extract extension (png, jpeg, etc.)
            if (preg_match('/data:image\/(.*?);base64/', $images[$i], $matches)) {
                $extension = strtolower($matches[1]);
           } else {
               $extension = 'png';
           }

           // Allow only safe extensions
           $allowed = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
            if (!in_array($extension, $allowed)) {
              http_response_code(400);
              echo json_encode(["error" => "Invalid image type"]);
              $conn->close();
              exit();
            }

            // Ensure directory exists
            $uploadDir = __DIR__ . "/uploaded_images/";
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }

            // Generate unique filename
            $filename = "user_" . $publisher_id . "_" . time() . "." . $extension;
            $filePath = $uploadDir . $filename;

            // Save file
            if (!file_put_contents($filePath, $imageBase64)) {
                http_response_code(500);
                echo json_encode(["error" => "Failed to save image"]);
                $conn->close();
                exit();
            }

            // Store relative path in DB
            $image_paths[] = "api/uploaded_images/" . $filename;
        }

    } else {
        // If already a filepath or empty, keep as-is
        $image_paths[] = $images[$i];
    }
}

// Validate input lengths
if (strlen($title) > 150) {
    http_response_code(400);
    echo json_encode(["error" => "Title cannot exceed 150 characters"]);
    $conn->close();
    exit();
}

if (strlen($description) > 10000) {
    http_response_code(400);
    echo json_encode(["error" => "Description cannot exceed 10,000 characters"]);
    $conn->close();
    exit();
}

if (strlen($category) > 80) {
    http_response_code(400);
    echo json_encode(["error" => "Category cannot exceed 80 characters"]);
    $conn->close();
    exit();
}

if (strlen($tags) > 255) {
    http_response_code(400);
    echo json_encode(["error" => "Tags cannot exceed 255 characters"]);
    $conn->close();
    exit();
}

if (strlen($materials_used) > 150) {
    http_response_code(400);
    echo json_encode(["error" => "Materials cannot exceed 150 characters"]);
    $conn->close();
    exit();
}

if (strlen($software_used) > 150) {
    http_response_code(400);
    echo json_encode(["error" => "Software cannot exceed 150 characters"]);
    $conn->close();
    exit();
}

$image_urls = json_encode($image_paths);

if($draft == 1){
    // Start transaction
    $conn->begin_transaction();

    $stmt_info = $conn->prepare("INSERT INTO in_progress (publisher_id, title, description, category, tags, materials_used, software_used, difficulty_level, image_urls, allow_comments, enable_downloads) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    if (!$stmt_info) {
        // Preparation failed, roll back and report
        $conn->rollback();
        http_response_code(500);
        echo json_encode(["error" => "User info query preparation failed: " . $conn->error]);
        $conn->close();
        exit();
    }
    $stmt_info->bind_param("issssssssii", $publisher_id, $title, $description, $category, $tags, $materials_used, $software_used, $difficulty_level, $image_urls, $allow_comments, $enable_downloads);

    // execute the insert and commit transaction
    if (!$stmt_info->execute()) {
        $conn->rollback();
        http_response_code(500);
        echo json_encode(["error" => "Project insert failed: " . $stmt_info->error]);
        $stmt_info->close();
        $conn->close();
       exit();
    }

    $conn->commit();
    $insert_id = $stmt_info->insert_id;
    $stmt_info->close();
    $conn->close();

    // return success response including new project ID
    echo json_encode(["success" => true, "project_id" => $insert_id]);
    exit();
} else{
    // Start transaction
    $conn->begin_transaction();

    $stmt_info = $conn->prepare("INSERT INTO projects (publisher_id, title, description, category, tags, materials_used, software_used, difficulty_level, image_urls, allow_comments, enable_downloads) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    if (!$stmt_info) {
        // Preparation failed, roll back and report
        $conn->rollback();
        http_response_code(500);
        echo json_encode(["error" => "User info query preparation failed: " . $conn->error]);
        $conn->close();
        exit();
    }
    $stmt_info->bind_param("issssssssii", $publisher_id, $title, $description, $category, $tags, $materials_used, $software_used, $difficulty_level, $image_urls, $allow_comments, $enable_downloads);

    // execute the insert and commit transaction
    if (!$stmt_info->execute()) {
        $conn->rollback();
        http_response_code(500);
        echo json_encode(["error" => "Project insert failed: " . $stmt_info->error]);
        $stmt_info->close();
        $conn->close();
        exit();
    }

    $conn->commit();
    $insert_id = $stmt_info->insert_id;
    $stmt_info->close();
    $conn->close();

    // return success response including new project ID
    echo json_encode(["success" => true, "project_id" => $insert_id]);
    exit();
}
