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
$required_fields = ['project_id', 'post', 'title', 'description', 'category', 'allow_comments', 'difficulty_level', 'enable_downloads'];
foreach ($required_fields as $field) {
    if (!isset($input[$field])) {
        http_response_code(400);
        echo json_encode(["error" => "Missing required field: $field"]);
        $conn->close();
        exit();
    }
}

$csrfToken = $input['csrf_token'] ?? '';
if (!isset($_SESSION['csrf_token']) || $_SESSION['csrf_token'] !== (string)$csrfToken) {
    http_response_code(403);
    echo json_encode(["error" => "Invalid CSRF token"]);
    $conn->close();
    exit();
}

$project_id = intval($input['project_id']);
$post = intval($input['post']);
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
$images = $input['images'] ?? [];
$image_paths = [];

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

if (!isset($_SESSION['auth_token']) || !isset($_SESSION['user_id']) || $_SESSION['user_id'] !== $publisher_id) {
    http_response_code(403);
    echo json_encode(["error" => "Unauthorized: Publisher ID does not match logged-in user"]);
    $conn->close();
    exit();
}

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
            $image_paths[] = "/api/uploaded_images/" . $filename;
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

if ($tags && strlen($tags) > 255) {
    http_response_code(400);
    echo json_encode(["error" => "Tags cannot exceed 255 characters"]);
    $conn->close();
    exit();
}

if ($materials_used && strlen($materials_used) > 150) {
    http_response_code(400);
    echo json_encode(["error" => "Materials cannot exceed 150 characters"]);
    $conn->close();
    exit();
}

if ($software_used && strlen($software_used) > 150) {
    http_response_code(400);
    echo json_encode(["error" => "Software cannot exceed 150 characters"]);
    $conn->close();
    exit();
}

$image_urls = json_encode($image_paths);

$conn->begin_transaction();

try {
    if ($post == 0) {
        $accessStmt = $conn->prepare(
            "SELECT project_id FROM in_progress WHERE project_id = ? AND (publisher_id = ? OR EXISTS (SELECT 1 FROM shared_draft_members sdm WHERE sdm.draft_id = in_progress.project_id AND sdm.user_id = ?)) LIMIT 1"
        );
        if (!$accessStmt) {
            throw new Exception("Access check failed: " . $conn->error);
        }
        $accessStmt->bind_param("iii", $project_id, $publisher_id, $publisher_id);
        $accessStmt->execute();
        $accessRes = $accessStmt->get_result();
        if (!$accessRes || $accessRes->num_rows === 0) {
            $accessStmt->close();
            throw new Exception("You do not have permission to update this draft");
        }
        $accessStmt->close();

        // Update in_progress
        $stmt = $conn->prepare("UPDATE in_progress SET title = ?, description = ?, category = ?, tags = ?, materials_used = ?, software_used = ?, difficulty_level = ?, image_urls = ?, allow_comments = ?, enable_downloads = ? WHERE project_id = ? AND (publisher_id = ? OR EXISTS (SELECT 1 FROM shared_draft_members sdm WHERE sdm.draft_id = in_progress.project_id AND sdm.user_id = ?))");
        if (!$stmt) {
            throw new Exception("Query preparation failed: " . $conn->error);
        }
        $stmt->bind_param("ssssssssiiiii", $title, $description, $category, $tags, $materials_used, $software_used, $difficulty_level, $image_urls, $allow_comments, $enable_downloads, $project_id, $publisher_id, $publisher_id);
        if (!$stmt->execute()) {
            throw new Exception("Update failed: " . $stmt->error);
        }
        $stmt->close();
    } elseif ($post == 1) {
        $accessStmt = $conn->prepare(
            "SELECT project_id FROM in_progress WHERE project_id = ? AND (publisher_id = ? OR EXISTS (SELECT 1 FROM shared_draft_members sdm WHERE sdm.draft_id = in_progress.project_id AND sdm.user_id = ?)) LIMIT 1"
        );
        if (!$accessStmt) {
            throw new Exception("Access check failed: " . $conn->error);
        }
        $accessStmt->bind_param("iii", $project_id, $publisher_id, $publisher_id);
        $accessStmt->execute();
        $accessRes = $accessStmt->get_result();
        if (!$accessRes || $accessRes->num_rows === 0) {
            $accessStmt->close();
            throw new Exception("You do not have permission to publish this draft");
        }
        $accessStmt->close();

        // If this draft belongs to a group request, enforce completion of all roles
        $groupDraftStmt = $conn->prepare(
            "SELECT sdm.project_request_id, pr.project_type
             FROM shared_draft_members sdm
             INNER JOIN project_requests pr ON pr.project_id = sdm.project_request_id
             WHERE sdm.draft_id = ? AND sdm.project_request_id IS NOT NULL
             ORDER BY sdm.project_request_id DESC
             LIMIT 1"
        );
        if ($groupDraftStmt) {
            $groupDraftStmt->bind_param("i", $project_id);
            $groupDraftStmt->execute();
            $groupDraftRes = $groupDraftStmt->get_result();
            $groupDraftRow = $groupDraftRes ? $groupDraftRes->fetch_assoc() : null;
            $groupDraftStmt->close();

            $projectType = strtolower(trim(strval($groupDraftRow['project_type'] ?? '')));
            $groupProjectRequestId = isset($groupDraftRow['project_request_id']) ? intval($groupDraftRow['project_request_id']) : 0;

            if ($projectType === 'group' && $groupProjectRequestId > 0) {
                $roleCountStmt = $conn->prepare(
                    "SELECT
                        COUNT(*) AS total_slots,
                        SUM(status = 'completed') AS completed_slots
                     FROM project_request_roles
                     WHERE project_id = ?"
                );
                if (!$roleCountStmt) {
                    throw new Exception("Failed to validate group role completion");
                }
                $roleCountStmt->bind_param("i", $groupProjectRequestId);
                $roleCountStmt->execute();
                $roleCountRes = $roleCountStmt->get_result();
                $roleCounts = $roleCountRes ? $roleCountRes->fetch_assoc() : null;
                $roleCountStmt->close();

                $totalSlots = intval($roleCounts['total_slots'] ?? 0);
                $completedSlots = intval($roleCounts['completed_slots'] ?? 0);

                if ($totalSlots === 0 || $completedSlots < $totalSlots) {
                    $remaining = max(0, $totalSlots - $completedSlots);
                    $conn->rollback();
                    http_response_code(400);
                    echo json_encode([
                        "error" => $totalSlots === 0
                            ? "This group project cannot be published until group roles are configured and completed."
                            : "This group project cannot be published yet. $remaining role(s) are still not marked complete."
                    ]);
                    $conn->close();
                    exit();
                }
            }
        }

        // Insert into projects
        $stmt = $conn->prepare("INSERT INTO projects (publisher_id, title, description, category, tags, materials_used, software_used, difficulty_level, image_urls, allow_comments, enable_downloads) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        if (!$stmt) {
            throw new Exception("Query preparation failed: " . $conn->error);
        }
        $stmt->bind_param("issssssssii", $publisher_id, $title, $description, $category, $tags, $materials_used, $software_used, $difficulty_level, $image_urls, $allow_comments, $enable_downloads);
        if (!$stmt->execute()) {
            throw new Exception("Insert failed: " . $stmt->error);
        }
        $new_project_id = $stmt->insert_id;
        $stmt->close();

        // Delete from in_progress
        $stmt = $conn->prepare("DELETE FROM in_progress WHERE project_id = ? AND (publisher_id = ? OR EXISTS (SELECT 1 FROM shared_draft_members sdm WHERE sdm.draft_id = in_progress.project_id AND sdm.user_id = ?))");
        if (!$stmt) {
            throw new Exception("Query preparation failed: " . $conn->error);
        }
        $stmt->bind_param("iii", $project_id, $publisher_id, $publisher_id);
        if (!$stmt->execute()) {
            throw new Exception("Delete failed: " . $stmt->error);
        }
        $stmt->close();

        $cleanupStmt = $conn->prepare("DELETE FROM shared_draft_members WHERE draft_id = ?");
        if ($cleanupStmt) {
            $cleanupStmt->bind_param("i", $project_id);
            $cleanupStmt->execute();
            $cleanupStmt->close();
        }
    } else {
        throw new Exception("Invalid post value");
    }

    $conn->commit();
    echo json_encode(["success" => true, "project_id" => $post == 1 ? $new_project_id : $project_id]);
} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}

$conn->close();
