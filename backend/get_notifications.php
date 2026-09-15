<?php
session_start();
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET");
header("Access-Control-Allow-Headers: Content-Type");

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    exit(json_encode(["error" => "Not authenticated"]));
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    exit(json_encode(["error" => "Database connection failed"]));
}

$userId = intval($_SESSION['user_id']);

// ── Deadline reminder scan (runs on every poll — deduped via log table) ──────
$deadlineStmt = $conn->prepare("
    SELECT pr.project_id,
           pr.project_title,
           pr.deadline,
           pr.publisher_id,
           pr.accepted_by_user_id,
           DATEDIFF(pr.deadline, CURDATE()) AS days_left
    FROM project_requests pr
    WHERE pr.status = 'accepted'
      AND pr.deadline IS NOT NULL
      AND DATEDIFF(pr.deadline, CURDATE()) BETWEEN 0 AND 7
");
$deadlineStmt->execute();
$deadlineResult = $deadlineStmt->get_result();

while ($dr = $deadlineResult->fetch_assoc()) {
    $reqId    = intval($dr['project_id']);
    $daysLeft = intval($dr['days_left']);
    $title    = $dr['project_title'];
    $deadline = $dr['deadline'];
    $posterId = intval($dr['publisher_id']);
    $implId   = $dr['accepted_by_user_id'] ? intval($dr['accepted_by_user_id']) : null;

    $threshold = $daysLeft <= 3 ? 3 : 7;

    $dupCheck = $conn->prepare("
        SELECT id FROM deadline_reminder_log
        WHERE project_request_id = ? AND threshold_days = ?
    ");
    $dupCheck->bind_param("ii", $reqId, $threshold);
    $dupCheck->execute();
    $dupResult = $dupCheck->get_result();
    $alreadySent = ($dupResult->num_rows > 0);
    $dupCheck->close();
    if ($alreadySent) continue;

    $logStmt = $conn->prepare("
        INSERT IGNORE INTO deadline_reminder_log (project_request_id, threshold_days) VALUES (?, ?)
    ");
    $logStmt->bind_param("ii", $reqId, $threshold);
    $logStmt->execute();
    $logStmt->close();

    $urgency    = ($threshold === 3) ? "soon" : "upcoming";
    $notifTitle = ($threshold === 3) ? "Deadline in 3 days!" : "Deadline approaching";
    $notifMsg   = "\"$title\" is due on $deadline ($daysLeft day" . ($daysLeft === 1 ? "" : "s") . " left).";

    $ins = $conn->prepare("
        INSERT INTO notifications (user_id, type, project_request_id, title, message, urgency)
        VALUES (?, 'deadline_reminder', ?, ?, ?, ?)
    ");
    $ins->bind_param("iisss", $posterId, $reqId, $notifTitle, $notifMsg, $urgency);
    $ins->execute();
    $ins->close();

    if ($implId && $implId !== $posterId) {
        $ins2 = $conn->prepare("
            INSERT INTO notifications (user_id, type, project_request_id, title, message, urgency)
            VALUES (?, 'deadline_reminder', ?, ?, ?, ?)
        ");
        $ins2->bind_param("iisss", $implId, $reqId, $notifTitle, $notifMsg, $urgency);
        $ins2->execute();
        $ins2->close();
    }
}
$deadlineStmt->close();

// ── Fetch notifications for this user ────────────────────────────────────────
$fetchStmt = $conn->prepare("
    SELECT id, type, project_request_id, title, message, urgency, is_read, created_at
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
");
$fetchStmt->bind_param("i", $userId);
$fetchStmt->execute();
$fetchResult = $fetchStmt->get_result();

$notifications = [];
while ($row = $fetchResult->fetch_assoc()) {
    $reqId = $row['project_request_id'] ? intval($row['project_request_id']) : null;
    $notifications[] = [
        "id"         => (string)$row['id'],
        "type"       => $row['type'],
        "project_id" => $reqId ? (string)$reqId : null,
        "title"      => $row['title'],
        "message"    => $row['message'],
        "urgency"    => $row['urgency'],
        "link"       => $reqId ? "/requests?open=$reqId" : "/requests",
        "read"       => (bool)$row['is_read'],
        "created_at" => $row['created_at'],
    ];
}
$fetchStmt->close();

echo json_encode(["notifications" => $notifications]);
$conn->close();
?>