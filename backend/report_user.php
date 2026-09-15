<?php
session_start();
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Must be authenticated to report
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    exit(json_encode(["error" => "Not authenticated. Please log in first."]));
}

require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    exit(json_encode(["error" => "Database connection failed"]));
}

$reporterId = (int)$_SESSION['user_id'];
$input = json_decode(file_get_contents("php://input"), true);

// Accept either a username or user_id to identify who to report
$targetUsername = isset($input['target_username']) ? trim($input['target_username']) : null;
$targetUserId   = isset($input['target_user_id']) ? (int)$input['target_user_id'] : null;

if (!$targetUsername && !$targetUserId) {
    http_response_code(400);
    exit(json_encode(["error" => "target_username or target_user_id is required"]));
}

// Resolve target user ID
if ($targetUsername) {
    $stmt = $conn->prepare("SELECT user_id FROM profile WHERE username = ? LIMIT 1");
    $stmt->bind_param("s", $targetUsername);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) {
        http_response_code(404);
        exit(json_encode(["error" => "User not found"]));
    }
    $targetUserId = (int)$row['user_id'];
    $stmt->close();
}

// Cannot report yourself
if ($targetUserId === $reporterId) {
    http_response_code(400);
    exit(json_encode(["error" => "You cannot report yourself"]));
}

// Check if this reporter already reported this user
$checkStmt = $conn->prepare("SELECT id FROM user_reports WHERE reporter_id = ? AND reported_user_id = ? LIMIT 1");
$checkStmt->bind_param("ii", $reporterId, $targetUserId);
$checkStmt->execute();
$existing = $checkStmt->get_result()->fetch_assoc();
$checkStmt->close();

if ($existing) {
    http_response_code(409);
    exit(json_encode(["error" => "You have already reported this user"]));
}

// Insert the report
$insertStmt = $conn->prepare("INSERT INTO user_reports (reporter_id, reported_user_id) VALUES (?, ?)");
$insertStmt->bind_param("ii", $reporterId, $targetUserId);
if (!$insertStmt->execute()) {
    http_response_code(500);
    exit(json_encode(["error" => "Failed to submit report"]));
}
$insertStmt->close();

// Count total reports for this user
$countStmt = $conn->prepare("SELECT COUNT(*) AS cnt FROM user_reports WHERE reported_user_id = ?");
$countStmt->bind_param("i", $targetUserId);
$countStmt->execute();
$countRow = $countStmt->get_result()->fetch_assoc();
$countStmt->close();
$reportCount = (int)$countRow['cnt'];
if ($reportCount >= 5) {

    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

    try {
        $conn->begin_transaction();

        // -------------------------------
        // 1. Delete attachment FILES
        // -------------------------------
        $stmt = $conn->prepare("
            SELECT ma.stored_name
            FROM message_attachments ma
            JOIN messages m ON ma.message_id = m.message_id
            WHERE m.sender_id = ? OR m.recipient_id = ?
        ");
        $stmt->bind_param("ii", $targetUserId, $targetUserId);
        $stmt->execute();
        $res = $stmt->get_result();

        $uploadDir = __DIR__ . "/message_attachments_files/";
        while ($row = $res->fetch_assoc()) {
            $filePath = $uploadDir . $row['stored_name'];
            if (file_exists($filePath)) {
                unlink($filePath);
            }
        }
        $stmt->close();

        // -------------------------------
        // 2. Delete message attachments
        // -------------------------------
        $stmt = $conn->prepare("
            DELETE ma FROM message_attachments ma
            JOIN messages m ON ma.message_id = m.message_id
            WHERE m.sender_id = ? OR m.recipient_id = ?
        ");
        $stmt->bind_param("ii", $targetUserId, $targetUserId);
        $stmt->execute();
        $stmt->close();

        // -------------------------------
        // 3. Delete messages (CASCADE also handles attachments)
        // -------------------------------
        $stmt = $conn->prepare("
            DELETE FROM messages
            WHERE sender_id = ? OR recipient_id = ?
        ");
        $stmt->bind_param("ii", $targetUserId, $targetUserId);
        $stmt->execute();
        $stmt->close();

        // -------------------------------
        // 4. Notifications
        // -------------------------------
        $stmt = $conn->prepare("DELETE FROM notifications WHERE user_id = ?");
        $stmt->bind_param("i", $targetUserId);
        $stmt->execute();
        $stmt->close();

        // -------------------------------
        // 5. Deadline logs (FIXED)
        // -------------------------------
        $stmt = $conn->prepare("
            DELETE drl FROM deadline_reminder_log drl
            JOIN project_requests pr ON drl.project_request_id = pr.project_id
            WHERE pr.publisher_id = ? OR pr.accepted_by_user_id = ?
        ");
        $stmt->bind_param("ii", $targetUserId, $targetUserId);
        $stmt->execute();
        $stmt->close();

        // -------------------------------
        // 6. Project requests
        // -------------------------------
        $stmt = $conn->prepare("
            DELETE FROM project_requests
            WHERE publisher_id = ? OR accepted_by_user_id = ?
        ");
        $stmt->bind_param("ii", $targetUserId, $targetUserId);
        $stmt->execute();
        $stmt->close();

        // -------------------------------
        // 7. Projects + in_progress
        // -------------------------------
        $stmt = $conn->prepare("DELETE FROM projects WHERE publisher_id = ?");
        $stmt->bind_param("i", $targetUserId);
        $stmt->execute();
        $stmt->close();

        $stmt = $conn->prepare("DELETE FROM in_progress WHERE publisher_id = ?");
        $stmt->bind_param("i", $targetUserId);
        $stmt->execute();
        $stmt->close();

        // -------------------------------
        // 8. Likes / saves / feedback
        // -------------------------------
        $stmt = $conn->prepare("DELETE FROM liked_projects WHERE user_id = ?");
        $stmt->bind_param("i", $targetUserId);
        $stmt->execute();
        $stmt->close();

        $stmt = $conn->prepare("DELETE FROM saved_projects WHERE user_id = ?");
        $stmt->bind_param("i", $targetUserId);
        $stmt->execute();
        $stmt->close();

        $stmt = $conn->prepare("DELETE FROM feedback WHERE user_id = ?");
        $stmt->bind_param("i", $targetUserId);
        $stmt->execute();
        $stmt->close();

        // -------------------------------
        // 9. Friends (YOU MISSED THIS TABLE)
        // -------------------------------
        $stmt = $conn->prepare("
            DELETE FROM friends
            WHERE follower_id = ? OR followed_id = ?
        ");
        $stmt->bind_param("ii", $targetUserId, $targetUserId);
        $stmt->execute();
        $stmt->close();

        // -------------------------------
        // 10. Reports
        // -------------------------------
        $stmt = $conn->prepare("
            DELETE FROM user_reports
            WHERE reporter_id = ? OR reported_user_id = ?
        ");
        $stmt->bind_param("ii", $targetUserId, $targetUserId);
        $stmt->execute();
        $stmt->close();

        // -------------------------------
        // 11. User skills
        // -------------------------------
        $stmt = $conn->prepare("DELETE FROM user_skills WHERE user_id = ?");
        $stmt->bind_param("i", $targetUserId);
        $stmt->execute();
        $stmt->close();

        // -------------------------------
        // 12. User info
        // -------------------------------
        $stmt = $conn->prepare("DELETE FROM user_info WHERE user_id = ?");
        $stmt->bind_param("i", $targetUserId);
        $stmt->execute();
        $stmt->close();

        // -------------------------------
        // 13. Profile LAST (important)
        // -------------------------------
        $stmt = $conn->prepare("DELETE FROM profile WHERE user_id = ?");
        $stmt->bind_param("i", $targetUserId);
        $stmt->execute();
        $stmt->close();

        $conn->commit();

        echo json_encode([
            "success" => true,
            "message" => "Account deleted successfully",
            "account_deleted" => true
        ]);

    } catch (Exception $e) {
        $conn->rollback();

        http_response_code(500);
        echo json_encode([
            "error" => "Deletion failed",
            "details" => $e->getMessage()
        ]);
    }

    $conn->close();
    exit();
}