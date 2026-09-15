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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit(json_encode(["error" => "Method not allowed"]));
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    exit(json_encode(["error" => "Not authenticated. Please log in first."]));
}

$input       = json_decode(file_get_contents("php://input"), true);
$project_id  = $input['project_id'] ?? null;
$action      = trim(strval($input['action'] ?? 'accept'));
$roleName    = trim(strval($input['role'] ?? $input['role_name'] ?? ''));
$roleIdInput = isset($input['role_id']) ? intval($input['role_id']) : 0;

if (!$project_id) {
    http_response_code(400);
    exit(json_encode(["error" => "Project ID is required"]));
}

require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    exit(json_encode(["error" => "Database connection failed"]));
}

$conn->query(
    "CREATE TABLE IF NOT EXISTS notifications (\n" .
    "    id INT AUTO_INCREMENT PRIMARY KEY,\n" .
    "    user_id INT NOT NULL,\n" .
    "    type VARCHAR(64) NOT NULL,\n" .
    "    project_request_id INT DEFAULT NULL,\n" .
    "    title VARCHAR(255) NOT NULL,\n" .
    "    message TEXT NOT NULL,\n" .
    "    urgency VARCHAR(16) DEFAULT NULL,\n" .
    "    is_read TINYINT(1) NOT NULL DEFAULT 0,\n" .
    "    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n" .
    "    INDEX idx_user_id (user_id),\n" .
    "    INDEX idx_project_request_id (project_request_id)\n" .
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci"
);

$conn->query(
    "CREATE TABLE IF NOT EXISTS project_request_roles (\n" .
    "    role_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,\n" .
    "    project_id INT NOT NULL,\n" .
    "    role_name VARCHAR(100) NOT NULL,\n" .
    "    slot_index INT NOT NULL,\n" .
    "    status ENUM('open','filled','completed') NOT NULL DEFAULT 'open',\n" .
    "    assigned_user_id INT DEFAULT NULL,\n" .
    "    assigned_at DATETIME DEFAULT NULL,\n" .
    "    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n" .
    "    INDEX idx_project_id (project_id)\n" .
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci"
);

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

$stmt = $conn->prepare(
    "SELECT pr.budget, pr.status, pr.publisher_id, pr.project_type, pr.accepted_by_user_id,\n" .
    "       pr.assignee_approved, pr.project_title,\n" .
    "       p.username AS publisher_username,\n" .
    "       ap.username AS implementer_username\n" .
    " FROM project_requests pr\n" .
    " LEFT JOIN profile p  ON pr.publisher_id        = p.user_id\n" .
    " LEFT JOIN profile ap ON pr.accepted_by_user_id = ap.user_id\n" .
    " WHERE pr.project_id = ?"
);
$stmt->bind_param("i", $project_id);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    http_response_code(404);
    exit(json_encode(["error" => "Project request not found"]));
}

$row                 = $result->fetch_assoc();
$budget              = $row['budget'];
$currentStatus       = $row['status'] ?? 'pending';
$publisherId         = isset($row['publisher_id'])        ? intval($row['publisher_id'])        : null;
$projectType         = trim(strval($row['project_type'] ?? 'individual'));
$acceptedByUserId    = isset($row['accepted_by_user_id']) ? intval($row['accepted_by_user_id']) : null;
$assigneeApproved    = isset($row['assignee_approved'])   ? intval($row['assignee_approved'])   : 0;
$projectTitle        = $row['project_title'] ?? 'the project';
$publisherUsername   = $row['publisher_username']  ?? 'the client';
$implementerUsername = $row['implementer_username'] ?? 'the creator';
$sessionUserId       = intval($_SESSION['user_id']);

$newStatus           = $currentStatus;
$newAcceptedByUserId = $acceptedByUserId;
$newAssigneeApproved = $assigneeApproved;
$successMessage      = '';

function insertNotification($conn, $userId, $type, $projectId, $title, $message, $urgency = null) {
    if (!$userId) return;
    $ins = $conn->prepare("INSERT INTO notifications (user_id, type, project_request_id, title, message, urgency) VALUES (?, ?, ?, ?, ?, ?)");
    if (!$ins) {
        return;
    }
    $ins->bind_param("isisss", $userId, $type, $projectId, $title, $message, $urgency);
    $ins->execute();
    $ins->close();
}

function ensureSharedDraftForGroupRequest($conn, $projectId, $publisherId, $projectTitle) {
    if (!$projectId || !$publisherId) {
        return null;
    }

    $findDraftStmt = $conn->prepare(
        "SELECT draft_id FROM shared_draft_members WHERE project_request_id = ? ORDER BY draft_id ASC LIMIT 1"
    );
    if (!$findDraftStmt) {
        return null;
    }
    $findDraftStmt->bind_param("i", $projectId);
    $findDraftStmt->execute();
    $draftResult = $findDraftStmt->get_result();
    if ($draftResult && $draftResult->num_rows > 0) {
        $draftRow = $draftResult->fetch_assoc();
        $findDraftStmt->close();
        return intval($draftRow['draft_id']);
    }
    $findDraftStmt->close();

    $title = trim(strval($projectTitle));
    if ($title === '') {
        $title = 'Group Project Draft';
    }
    if (strlen($title) > 150) {
        $title = substr($title, 0, 150);
    }

    $emptyImages = json_encode([]);
    $insertDraftStmt = $conn->prepare(
        "INSERT INTO in_progress (publisher_id, title, description, category, tags, materials_used, software_used, difficulty_level, image_urls, allow_comments, enable_downloads) VALUES (?, ?, '', 'Group Project', NULL, NULL, NULL, 'intermediate', ?, 1, 0)"
    );
    if (!$insertDraftStmt) {
        return null;
    }
    $insertDraftStmt->bind_param("iss", $publisherId, $title, $emptyImages);
    if (!$insertDraftStmt->execute()) {
        $insertDraftStmt->close();
        return null;
    }
    $draftId = intval($insertDraftStmt->insert_id);
    $insertDraftStmt->close();

    return $draftId;
}

function syncSharedDraftMembersForGroupRequest($conn, $projectId, $publisherId, $projectTitle) {
    if (!$projectId || !$publisherId) {
        return null;
    }

    $draftId = ensureSharedDraftForGroupRequest($conn, $projectId, $publisherId, $projectTitle);
    if (!$draftId) {
        return null;
    }

    $memberIds = [$publisherId];

    $memberStmt = $conn->prepare(
        "SELECT assigned_user_id FROM project_request_roles WHERE project_id = ? AND status IN ('filled', 'completed') AND assigned_user_id IS NOT NULL"
    );
    if ($memberStmt) {
        $memberStmt->bind_param("i", $projectId);
        $memberStmt->execute();
        $memberResult = $memberStmt->get_result();
        while ($memberResult && ($memberRow = $memberResult->fetch_assoc())) {
            $assignedUserId = intval($memberRow['assigned_user_id']);
            if ($assignedUserId > 0) {
                $memberIds[] = $assignedUserId;
            }
        }
        $memberStmt->close();
    }

    $memberIds = array_values(array_unique(array_filter($memberIds, function ($id) {
        return intval($id) > 0;
    })));

    if (count($memberIds) === 0) {
        return $draftId;
    }

    $deleteOthers = $conn->prepare("DELETE FROM shared_draft_members WHERE draft_id = ? AND user_id NOT IN (" . implode(",", $memberIds) . ")");
    if ($deleteOthers) {
        $deleteOthers->bind_param("i", $draftId);
        $deleteOthers->execute();
        $deleteOthers->close();
    }

    $insertMember = $conn->prepare(
        "INSERT INTO shared_draft_members (draft_id, user_id, project_request_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE project_request_id = VALUES(project_request_id)"
    );
    if ($insertMember) {
        foreach ($memberIds as $memberId) {
            $memberIdInt = intval($memberId);
            $insertMember->bind_param("iii", $draftId, $memberIdInt, $projectId);
            $insertMember->execute();
        }
        $insertMember->close();
    }

    return $draftId;
}

function deleteProjectGroupChats($conn, $projectId) {
    $projectId = intval($projectId);
    if ($projectId < 1) return;

    // Delete messages first, then members, then conversations (handles FK constraints without relying on CASCADE)
    $delMessages = $conn->prepare(
        "DELETE gm FROM group_messages gm
         INNER JOIN group_conversations gc ON gm.conversation_id = gc.conversation_id
         WHERE gc.project_id = ?"
    );
    if ($delMessages) {
        $delMessages->bind_param("i", $projectId);
        $delMessages->execute();
        $delMessages->close();
    }

    $delMembers = $conn->prepare(
        "DELETE gcm FROM group_conversation_members gcm
         INNER JOIN group_conversations gc ON gcm.conversation_id = gc.conversation_id
         WHERE gc.project_id = ?"
    );
    if ($delMembers) {
        $delMembers->bind_param("i", $projectId);
        $delMembers->execute();
        $delMembers->close();
    }

    $delConvos = $conn->prepare(
        "DELETE FROM group_conversations WHERE project_id = ?"
    );
    if ($delConvos) {
        $delConvos->bind_param("i", $projectId);
        $delConvos->execute();
        $delConvos->close();
    }
}

function creditUserBalance($conn, $userId, $amount) {
    $userId = intval($userId);
    $amount = floatval($amount);

    if ($userId < 1 || $amount <= 0) {
        return false;
    }

    $creditStmt = $conn->prepare(
        "UPDATE user_info SET balance = COALESCE(balance, 0) + ? WHERE user_id = ?"
    );
    if (!$creditStmt) {
        return false;
    }

    $creditStmt->bind_param("di", $amount, $userId);
    $ok = $creditStmt->execute() && $creditStmt->affected_rows > 0;
    $creditStmt->close();

    return $ok;
}

function creditCompletedGroupMembers($conn, $projectId, $budget) {
    $projectId = intval($projectId);
    $budget = floatval($budget);

    if ($projectId < 1 || $budget <= 0) {
        return false;
    }

    $memberStmt = $conn->prepare(
        "SELECT DISTINCT assigned_user_id
         FROM project_request_roles
         WHERE project_id = ?
           AND status = 'completed'
           AND assigned_user_id IS NOT NULL"
    );
    if (!$memberStmt) {
        return false;
    }

    $memberStmt->bind_param("i", $projectId);
    $memberStmt->execute();
    $memberResult = $memberStmt->get_result();

    $memberIds = [];
    while ($memberResult && ($memberRow = $memberResult->fetch_assoc())) {
        $memberId = intval($memberRow['assigned_user_id'] ?? 0);
        if ($memberId > 0) {
            $memberIds[] = $memberId;
        }
    }
    $memberStmt->close();

    $memberIds = array_values(array_unique($memberIds));
    $memberCount = count($memberIds);
    if ($memberCount === 0) {
        return false;
    }

    $share = $budget / $memberCount;
    foreach ($memberIds as $memberId) {
        if (!creditUserBalance($conn, $memberId, $share)) {
            return false;
        }
    }

    return true;
}

if ($projectType === 'group' && in_array($action, ['accept', 'apply_role', 'approve_role', 'reject_role', 'complete_role'], true)) {
    if ($roleName === '') {
        http_response_code(400);
        exit(json_encode(["error" => "Role is required for group role actions"]));
    }
    if (!in_array($currentStatus, ['pending', 'accepted', 'completed'], true)) {
        http_response_code(400);
        exit(json_encode(["error" => "Only requests that are pending/in-progress can process group roles"]));
    }

    if ($action === 'approve_role' || $action === 'reject_role') {
        if ($publisherId === null || $publisherId !== $sessionUserId) {
            http_response_code(403);
            exit(json_encode(["error" => "Only the request owner can approve or reject applicants"]));
        }
        if ($roleIdInput < 1) {
            http_response_code(400);
            exit(json_encode(["error" => "role_id is required for approve/reject actions"]));
        }

        if ($action === 'approve_role') {
            $approveStmt = $conn->prepare(
                "UPDATE project_request_roles SET status = 'filled' WHERE role_id = ? AND project_id = ? AND role_name = ? AND assigned_user_id IS NOT NULL AND status = 'open'"
            );
            $approveStmt->bind_param("iis", $roleIdInput, $project_id, $roleName);
            if (!$approveStmt->execute() || $approveStmt->affected_rows === 0) {
                http_response_code(400);
                exit(json_encode(["error" => "No pending applicant found for this role slot"]));
            }
            $approveStmt->close();
            $successMessage = "Applicant approved for $roleName.";
            syncSharedDraftMembersForGroupRequest($conn, intval($project_id), intval($publisherId), $projectTitle);
        } else {
            $rejectStmt = $conn->prepare(
                "UPDATE project_request_roles SET assigned_user_id = NULL, assigned_at = NULL, status = 'open' WHERE role_id = ? AND project_id = ? AND role_name = ? AND assigned_user_id IS NOT NULL"
            );
            $rejectStmt->bind_param("iis", $roleIdInput, $project_id, $roleName);
            if (!$rejectStmt->execute() || $rejectStmt->affected_rows === 0) {
                http_response_code(400);
                exit(json_encode(["error" => "No applicant found for this role slot"]));
            }
            $rejectStmt->close();
            $successMessage = "Applicant rejected for $roleName.";
            syncSharedDraftMembersForGroupRequest($conn, intval($project_id), intval($publisherId), $projectTitle);
        }
    } elseif ($action === 'complete_role') {
        $conn->begin_transaction();

        $completeStmt = $conn->prepare(
            "UPDATE project_request_roles\n" .
            "SET status = 'completed'\n" .
            "WHERE project_id = ? AND role_name = ? AND assigned_user_id = ? AND status = 'filled'\n" .
            ($roleIdInput > 0 ? "AND role_id = ?" : "") .
            "\nLIMIT 1"
        );
        if ($roleIdInput > 0) {
            $completeStmt->bind_param("isii", $project_id, $roleName, $sessionUserId, $roleIdInput);
        } else {
            $completeStmt->bind_param("isi", $project_id, $roleName, $sessionUserId);
        }
        if (!$completeStmt->execute() || $completeStmt->affected_rows === 0) {
            $conn->rollback();
            http_response_code(400);
            exit(json_encode(["error" => "You must be an approved creator for this role to mark it complete"]));
        }
        $completeStmt->close();
        $successMessage = "Role marked complete for $roleName.";
    } else {
        if ($publisherId !== null && $publisherId === $sessionUserId) {
            http_response_code(403);
            exit(json_encode(["error" => "You cannot apply to your own group request"]));
        }

        $skillStmt = $conn->prepare(
            "SELECT 1 FROM user_skills WHERE user_id = ? AND LOWER(TRIM(skill)) = LOWER(TRIM(?)) LIMIT 1"
        );
        if (!$skillStmt) {
            http_response_code(500);
            exit(json_encode(["error" => "Failed to verify user skills"]));
        }
        $skillStmt->bind_param("is", $sessionUserId, $roleName);
        $skillStmt->execute();
        $skillResult = $skillStmt->get_result();
        if ($skillResult->num_rows === 0) {
            http_response_code(403);
            exit(json_encode(["error" => "You cannot apply: missing required skill for this role"]));
        }
        $skillStmt->close();

        $existingRoleStmt = $conn->prepare(
            "SELECT role_id FROM project_request_roles WHERE project_id = ? AND assigned_user_id = ? AND status IN ('open','filled','completed') LIMIT 1"
        );
        $existingRoleStmt->bind_param("ii", $project_id, $sessionUserId);
        $existingRoleStmt->execute();
        $existingRoleResult = $existingRoleStmt->get_result();
        if ($existingRoleResult->num_rows > 0) {
            http_response_code(400);
            exit(json_encode(["error" => "You can only apply for one role on this request"]));
        }
        $existingRoleStmt->close();

        $slotStmt = $conn->prepare(
            "SELECT role_id FROM project_request_roles\n" .
            "WHERE project_id = ? AND role_name = ? AND status = 'open' AND assigned_user_id IS NULL\n" .
            "ORDER BY slot_index ASC LIMIT 1"
        );
        $slotStmt->bind_param("is", $project_id, $roleName);
        $slotStmt->execute();
        $slotResult = $slotStmt->get_result();

        if ($slotResult->num_rows === 0) {
            http_response_code(400);
            exit(json_encode(["error" => "No open slots available for the requested role"]));
        }

        $roleRow = $slotResult->fetch_assoc();
        $roleId  = intval($roleRow['role_id']);
        $slotStmt->close();

        $applyStmt = $conn->prepare(
            "UPDATE project_request_roles SET assigned_user_id = ?, assigned_at = NOW(), status = 'open' WHERE role_id = ?"
        );
        $applyStmt->bind_param("ii", $sessionUserId, $roleId);
        if (!$applyStmt->execute()) {
            http_response_code(500);
            exit(json_encode(["error" => "Failed to apply for role"]));
        }
        $applyStmt->close();
        $successMessage = "Application submitted for $roleName.";
    }

    $countStmt = $conn->prepare(
        "SELECT\n" .
        "    COUNT(*) AS total_slots,\n" .
        "    SUM(status = 'open') AS open_slots,\n" .
        "    SUM(status = 'filled') AS filled_slots,\n" .
        "    SUM(status = 'completed') AS completed_slots\n" .
        "FROM project_request_roles\n" .
        "WHERE project_id = ?"
    );
    $countStmt->bind_param("i", $project_id);
    $countStmt->execute();
    $countResult = $countStmt->get_result();
    $counts = $countResult->fetch_assoc();
    $countStmt->close();

    $totalSlots     = intval($counts['total_slots'] ?? 0);
    $openSlots      = intval($counts['open_slots'] ?? 0);
    $filledSlots    = intval($counts['filled_slots'] ?? 0);
    $completedSlots = intval($counts['completed_slots'] ?? 0);

    if ($totalSlots > 0 && $completedSlots === $totalSlots) {
        $newStatus = 'completed';
        if ($successMessage === '') {
            $successMessage = "All roles are complete. This group request is now completed.";
        }
        if ($action === 'complete_role' && !creditCompletedGroupMembers($conn, intval($project_id), $budget)) {
            $conn->rollback();
            http_response_code(500);
            exit(json_encode(["error" => "Failed to distribute group project budget"]));
        }
        deleteProjectGroupChats($conn, intval($project_id));
    } elseif ($openSlots === 0) {
        $newStatus = 'accepted';
        if ($successMessage === '') {
            $successMessage = "All roles are filled and the group request is now in progress.";
        }
    } else {
        $newStatus = 'pending';
        if ($successMessage === '') {
            $successMessage = "$openSlots open role slot(s) remain.";
        } else {
            $successMessage .= " $openSlots open role slot(s) remain.";
        }
    }

    $updateProject = $conn->prepare("UPDATE project_requests SET status = ? WHERE project_id = ?");
    $updateProject->bind_param("si", $newStatus, $project_id);
    if (!$updateProject->execute()) {
        if ($action === 'complete_role') {
            $conn->rollback();
        }
        http_response_code(500);
        exit(json_encode(["error" => "Failed to update group request status"]));
    }
    $updateProject->close();

    if ($action === 'complete_role') {
        $conn->commit();
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => $successMessage,
        "project_id" => $project_id,
        "project_type" => $projectType,
        "status" => $newStatus,
        "role" => $roleName,
        "total_slots" => $totalSlots,
        "open_slots" => $openSlots,
        "filled_slots" => $filledSlots,
        "completed_slots" => $completedSlots,
        "assigned_user_id" => $sessionUserId,
    ]);
    $stmt->close();
    $conn->close();
    exit;
}

if ($projectType === 'group' && in_array($action, ['allow', 'reopen', 'complete'], true)) {
    http_response_code(400);
    exit(json_encode(["error" => "This action is not supported for group project requests"]));
}

if ($action === 'complete') {
    if ($currentStatus !== 'accepted') {
        http_response_code(400);
        exit(json_encode(["error" => "Only active requests can be completed"]));
    }
    if ($acceptedByUserId !== null && $acceptedByUserId !== $sessionUserId) {
        http_response_code(403);
        exit(json_encode(["error" => "Only the assigned creator can complete this request"]));
    }
    if ($assigneeApproved !== 1) {
        http_response_code(403);
        exit(json_encode(["error" => "You must wait for the client to allow completion"]));
    }
    $conn->begin_transaction();

    $newStatus      = 'completed';
    $successMessage = "Project request marked as completed";

    if (!creditUserBalance($conn, $sessionUserId, $budget)) {
        $conn->rollback();
        http_response_code(500);
        exit(json_encode(["error" => "Failed to credit project budget to creator balance"]));
    }

    deleteProjectGroupChats($conn, intval($project_id));

    insertNotification($conn, $publisherId, 'request_completed', intval($project_id),
        "Request completed",
        "\"$projectTitle\" has been marked as completed by @$implementerUsername."
    );

} elseif ($action === 'allow') {
    if ($currentStatus !== 'accepted') {
        http_response_code(400);
        exit(json_encode(["error" => "Only accepted requests can be allowed"]));
    }
    if ($publisherId === null || $publisherId !== $sessionUserId) {
        http_response_code(403);
        exit(json_encode(["error" => "Only the request owner can allow completion"]));
    }
    if ($acceptedByUserId === null) {
        http_response_code(400);
        exit(json_encode(["error" => "No assignee to allow yet"]));
    }
    $newStatus           = 'accepted';
    $newAssigneeApproved = 1;
    $successMessage      = "Assignee is now allowed to upload and complete";

    insertNotification($conn, $acceptedByUserId, 'completion_allowed', intval($project_id),
        "You're cleared to complete",
        "@$publisherUsername has allowed you to upload and complete \"$projectTitle\"."
    );

} elseif ($action === 'reopen') {
    if ($currentStatus !== 'accepted') {
        http_response_code(400);
        exit(json_encode(["error" => "Only in-progress requests can be returned to pending"]));
    }
    if ($publisherId === null || $publisherId !== $sessionUserId) {
        http_response_code(403);
        exit(json_encode(["error" => "Only the request owner can remove the assignee"]));
    }
    $newStatus           = 'pending';
    $newAcceptedByUserId = null;
    $newAssigneeApproved = 0;
    $successMessage      = "Project request is pending again";

    insertNotification($conn, $acceptedByUserId, 'request_reopened', intval($project_id),
        "Removed from request",
        "@$publisherUsername removed you from \"$projectTitle\". The request is open again."
    );

} else {
    if ($currentStatus !== 'pending') {
        http_response_code(400);
        exit(json_encode(["error" => "Only pending requests can be accepted"]));
    }
    if ($publisherId !== null && $publisherId === $sessionUserId) {
        http_response_code(403);
        exit(json_encode(["error" => "You cannot accept your own request"]));
    }

    $uStmt = $conn->prepare("SELECT username FROM profile WHERE user_id = ?");
    $uStmt->bind_param("i", $sessionUserId);
    $uStmt->execute();
    $uRow = $uStmt->get_result()->fetch_assoc();
    $sessionUsername = $uRow['username'] ?? 'Someone';
    $uStmt->close();

    $newStatus           = 'accepted';
    $newAcceptedByUserId = $sessionUserId;
    $newAssigneeApproved = 0;
    $successMessage      = "Project request accepted successfully";

    insertNotification($conn, $publisherId, 'request_accepted', intval($project_id),
        "Request accepted!",
        "@$sessionUsername accepted your request \"$projectTitle\". Review and allow them to complete it when ready."
    );

    insertNotification($conn, $sessionUserId, 'request_accepted_self', intval($project_id),
        "You accepted a request",
        "You accepted \"$projectTitle\" from @$publisherUsername. Wait for the client to allow completion."
    );
}

$updateStmt = $conn->prepare("UPDATE project_requests SET status = ?, accepted_by_user_id = ?, assignee_approved = ? WHERE project_id = ?");
$updateStmt->bind_param("siii", $newStatus, $newAcceptedByUserId, $newAssigneeApproved, $project_id);
if (!$updateStmt->execute()) {
    if ($action === 'complete') {
        $conn->rollback();
    }
    http_response_code(500);
    exit(json_encode(["error" => "Failed to update project status"]));
}
$updateStmt->close();

if ($action === 'complete') {
    $conn->commit();
}

http_response_code(200);
echo json_encode([
    "success"             => true,
    "message"             => $successMessage,
    "budget"              => $budget,
    "status"              => $newStatus,
    "accepted_by_user_id" => $newAcceptedByUserId,
    "assignee_approved"   => $newAssigneeApproved,
]);

$stmt->close();
$conn->close();
?>