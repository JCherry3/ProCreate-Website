<?php
session_start();
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Check if user is authenticated via session
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    exit(json_encode(["error" => "Not authenticated. Please log in first."]));
}

// Database connection
require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    exit(json_encode(["error" => "Database connection failed"]));
}

// Read JSON input
$input = json_decode(file_get_contents("php://input"), true);

// Validate required fields
$required_fields = ['firstName', 'lastName', 'username', 'location', 'bio', 'company', 'role', 'website'];
foreach ($required_fields as $field) {
    if (!isset($input[$field])) {
        http_response_code(400);
        echo json_encode(["error" => "Missing required field: $field"]);
        $conn->close();
        exit();
    }
}

$user_id = intval($_SESSION['user_id']);
$firstName = $input['firstName'];
$lastName = $input['lastName'];
$username = $input['username'];
$location = $input['location'];
$bio = $input['bio'];
$company = $input['company'];
$role = $input['role'];
$website = $input['website'] ?? '';
$picInput = $input['pic'] ?? '';
$pic = '';

if (!empty($picInput) && strpos($picInput, 'data:image') === 0) {

    // Split header and base64 data
    $imageParts = explode(";base64,", $picInput);

    if (count($imageParts) === 2) {

        $imageBase64 = base64_decode($imageParts[1]);

        // Extract extension (png, jpeg, etc.)
        if (preg_match('/data:image\/(.*?);base64/', $picInput, $matches)) {
            $extension = strtolower($matches[1]);
        } else {
            $extension = 'png';
        }

        // Allow only safe extensions
        $allowed = ['png', 'jpg', 'jpeg', 'webp'];
        if (!in_array($extension, $allowed)) {
            http_response_code(400);
            echo json_encode(["error" => "Invalid image type"]);
            $conn->close();
            exit();
        }

        // Ensure directory exists
        $uploadDir = __DIR__ . "/profile_pics/";
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        // Generate unique filename
        $filename = "user_" . $user_id . "_" . time() . "." . $extension;
        $filePath = $uploadDir . $filename;

        // Save file
        if (!file_put_contents($filePath, $imageBase64)) {
            http_response_code(500);
            echo json_encode(["error" => "Failed to save image"]);
            $conn->close();
            exit();
        }

        // Store relative path in DB
        $pic = "profile_pics/" . $filename;
    }

} else {
    // If already a filepath or empty, keep as-is
    $pic = $picInput;
}
$showEmail = isset($input['showEmail']) ? intval($input['showEmail']) : 0;

// Validate input lengths
if (strlen($firstName) > 100 || strlen($lastName) > 100 || strlen($username) > 100) {
    http_response_code(400);
    echo json_encode(["error" => "Name fields cannot exceed 100 characters"]);
    $conn->close();
    exit();
}

if (strlen($bio) > 500) {
    http_response_code(400);
    echo json_encode(["error" => "Bio cannot exceed 500 characters"]);
    $conn->close();
    exit();
}

// Check if username is already taken by another user
$stmt_check = $conn->prepare("SELECT user_id FROM profile WHERE username = ? AND user_id != ?");
if (!$stmt_check) {
    http_response_code(500);
    exit(json_encode(["error" => "Query preparation failed: " . $conn->error]));
}

$stmt_check->bind_param("si", $username, $user_id);
$stmt_check->execute();
$result_check = $stmt_check->get_result();

if ($result_check->num_rows > 0) {
    http_response_code(409);
    echo json_encode(["error" => "Username already taken"]);
    $stmt_check->close();
    $conn->close();
    exit();
}

$stmt_check->close();

// Start transaction
$conn->begin_transaction();

try {
    // Update profile table
    $stmt_profile = $conn->prepare("UPDATE profile SET `first name` = ?, `last name` = ?, username = ? WHERE user_id = ?");
    if (!$stmt_profile) {
        throw new Exception("Profile query preparation failed: " . $conn->error);
    }
    
    $stmt_profile->bind_param("sssi", $firstName, $lastName, $username, $user_id);
    if (!$stmt_profile->execute()) {
        throw new Exception("Profile update failed: " . $stmt_profile->error);
    }
    $stmt_profile->close();

    // Check if user already exists in user_info table
    $stmt_check_info = $conn->prepare("SELECT user_id FROM user_info WHERE user_id = ?");
    $stmt_check_info->bind_param("i", $user_id);
    $stmt_check_info->execute();
    $result_info = $stmt_check_info->get_result();
    $stmt_check_info->close();

    if ($result_info->num_rows > 0) {
        // Update existing user_info record
        $stmt_info = $conn->prepare("UPDATE user_info SET location = ?, bio = ?, company = ?, job = ?, website = ?, pic = ?, showEmail = ? WHERE user_id = ?");
        if (!$stmt_info) {
            throw new Exception("User info query preparation failed: " . $conn->error);
        }
        
        $stmt_info->bind_param("ssssssii", $location, $bio, $company, $role, $website, $pic, $showEmail, $user_id);
    } else {
        // Insert new user_info record
        $followers = 0;
        $following = 0;
        $stmt_info = $conn->prepare("INSERT INTO user_info (user_id, location, bio, company, job, website, pic, followers, following, showEmail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        if (!$stmt_info) {
            throw new Exception("User info query preparation failed: " . $conn->error);
        }
        
        $stmt_info->bind_param("isssssiiii", $user_id, $location, $bio, $company, $role, $website, $pic, $followers, $following, $showEmail);
    }
    
    if (!$stmt_info->execute()) {
        throw new Exception("User info update/insert failed: " . $stmt_info->error);
    }
    $stmt_info->close();

    // Commit transaction
    $conn->commit();
    
    http_response_code(200);
    echo json_encode(["success" => true, "message" => "Profile updated successfully"]);
    
} catch (Exception $e) {
    // Rollback transaction on error
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}

$conn->close();
?>
