<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST");
header("Access-Control-Allow-Headers: Content-Type");

require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed"]);
    exit;
}


$sql = "
    SELECT 
        pr.project_id,
        pr.publisher_id,
        pr.project_type,
        pr.accepted_by_user_id,
        pr.assignee_approved,
        pr.project_title,
        pr.category,
        pr.description,
        pr.budget,
        pr.deadline,
        pr.date_of_request,
        pr.status,
        p.`first name` AS first_name,
        p.`last name` AS last_name,
        p.username,
        ap.username AS implementer_username,
        r.role_id,
        r.role_name,
        r.status AS role_status,
        r.assigned_user_id,
        upr.username AS assigned_username,
        sdm.draft_id AS shared_draft_id
    FROM project_requests pr
    LEFT JOIN profile p ON pr.publisher_id = p.user_id
    LEFT JOIN profile ap ON pr.accepted_by_user_id = ap.user_id
    LEFT JOIN project_request_roles r ON pr.project_id = r.project_id
    LEFT JOIN profile upr ON r.assigned_user_id = upr.user_id
    LEFT JOIN (
        SELECT project_request_id, MIN(draft_id) AS draft_id
        FROM shared_draft_members
        WHERE project_request_id IS NOT NULL
        GROUP BY project_request_id
    ) sdm ON sdm.project_request_id = pr.project_id
    ORDER BY pr.date_of_request DESC, r.slot_index ASC
";

$stmt = $conn->prepare($sql);
if (!$stmt) {
    http_response_code(500);
    echo json_encode(["error" => "Query preparation failed: " . $conn->error]);
    exit;
}

$stmt->execute();
$result = $stmt->get_result();
$requestsById = [];

while ($row = $result->fetch_assoc()) {
    $projectId = (string) $row['project_id'];

    if (!isset($requestsById[$projectId])) {
        $clientName = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
        if ($clientName === '') {
            $clientName = $row['username'] ?? '';
        }

        $requestsById[$projectId] = [
            "id" => $projectId,
            "publisherId" => (string) $row['publisher_id'],
            "acceptedBy" => isset($row['accepted_by_user_id']) ? (string) $row['accepted_by_user_id'] : null,
            "assigneeApproved" => isset($row['assignee_approved']) ? intval($row['assignee_approved']) : 0,
            "implementerUsername" => $row['implementer_username'] ?? null,
            "project_type" => $row['project_type'] ?? 'individual',
            "sharedDraftId" => isset($row['shared_draft_id']) ? (string)$row['shared_draft_id'] : null,
            "title" => $row['project_title'],
            "client" => $clientName,
            "budget" => "$" . number_format(floatval($row['budget']), 2),
            "deadline" => $row['deadline'],
            "submittedAt" => $row['date_of_request'],
            "status" => $row['status'] ?? "pending",
            "description" => $row['description'],
            "category" => $row['category'],
            "roles" => [],
        ];
    }

    if (!empty($row['role_name'])) {
        $requestsById[$projectId]['roles'][] = [
            "roleId" => isset($row['role_id']) ? intval($row['role_id']) : null,
            "role" => $row['role_name'],
            "status" => $row['role_status'] ?? 'open',
            "assignedUserId" => isset($row['assigned_user_id']) ? (string) $row['assigned_user_id'] : null,
            "assignedUsername" => $row['assigned_username'] ?? null,
        ];
    }
}

$requests = array_values($requestsById);
http_response_code(200);
echo json_encode($requests);

$stmt->close();
$conn->close();
