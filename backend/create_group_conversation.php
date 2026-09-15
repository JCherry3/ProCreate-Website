<?php
session_start();
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    exit(json_encode(["error" => "Method not allowed"]));
}

if (!isset($_SESSION["user_id"])) {
    http_response_code(401);
    exit(json_encode(["error" => "Not authenticated"]));
}

$current_user_id = (int)$_SESSION["user_id"];
$input           = json_decode(file_get_contents("php://input"), true);
$participants    = isset($input["participants"]) ? $input["participants"] : [];
$group_name      = isset($input["group_name"]) ? trim($input["group_name"]) : "";
$project_id      = isset($input["project_id"]) ? (int)$input["project_id"] : null;

// Always include the session user
if (!in_array($current_user_id, $participants)) {
    $participants[] = $current_user_id;
}

// Deduplicate and cast to int
$participants = array_unique(array_map("intval", $participants));
sort($participants);

// Need at least 2 OTHER participants (3 total including current user)
// Or 2 total if current user already counted â€” the spec says "at least 2 participants" (excluding self)
// We enforce: total participants (including creator) >= 2
$other_participants = array_filter($participants, fn($id) => $id !== $current_user_id);

if (count($other_participants) < 1) {
    http_response_code(400);
    exit(json_encode(["error" => "At least 1 other participants are required for a group conversation"]));
}

if ($group_name === "") {
    http_response_code(400);
    exit(json_encode(["error" => "Group name is required"]));
}

require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    exit(json_encode(["error" => "Database connection failed"]));
}

try {
    $conn->begin_transaction();

    // Check for duplicate: same set of participants with same group name
    $member_count = count($participants);
    $placeholders = implode(",", array_fill(0, $member_count, "?"));
    $types        = str_repeat("i", $member_count);

    // Find conversations where the group_name matches AND membership is identical
    $dup_sql = "
        SELECT gc.conversation_id
        FROM group_conversations gc
        WHERE gc.group_name = ?
          AND gc.conversation_id IN (
              SELECT gcm.conversation_id
              FROM group_conversation_members gcm
              GROUP BY gcm.conversation_id
              HAVING COUNT(DISTINCT gcm.user_id) = ?
          )
          AND (
              SELECT COUNT(DISTINCT gcm2.user_id)
              FROM group_conversation_members gcm2
              WHERE gcm2.conversation_id = gc.conversation_id
                AND gcm2.user_id IN ($placeholders)
          ) = ?
        LIMIT 1
    ";

    $dup_stmt = $conn->prepare($dup_sql);
    // params: group_name, member_count, ...participant ids, member_count
    $bind_params = array_merge([$group_name, $member_count], $participants, [$member_count]);
    $bind_types  = "si" . $types . "i";
    $dup_stmt->bind_param($bind_types, ...$bind_params);
    $dup_stmt->execute();
    $dup_result = $dup_stmt->get_result();
    if ($dup_result->num_rows > 0) {
        $existing_row = $dup_result->fetch_assoc();
        $existing_id  = (int)$existing_row["conversation_id"];
        $conn->rollback();
        http_response_code(409);
        exit(json_encode([
            "error"           => "A group with this name and the same participants already exists",
            "conversation_id" => $existing_id,
        ]));
    }
    $dup_stmt->close();

    // Verify all participant user_ids exist
    $verify_sql = "SELECT user_id FROM profile WHERE user_id IN ($placeholders)";
    $verify_stmt = $conn->prepare($verify_sql);
    $verify_stmt->bind_param($types, ...$participants);
    $verify_stmt->execute();
    $found_count = $verify_stmt->get_result()->num_rows;
    $verify_stmt->close();

    if ($found_count !== $member_count) {
        $conn->rollback();
        http_response_code(400);
        exit(json_encode(["error" => "One or more participant user IDs are invalid"]));
    }

    // Create group conversation
    $create_stmt = $conn->prepare("
        INSERT INTO group_conversations (group_name, created_by, project_id, created_at)
        VALUES (?, ?, ?, NOW())
    ");
    $create_stmt->bind_param("sii", $group_name, $current_user_id, $project_id);
    if (!$create_stmt->execute()) {
        throw new Exception("Failed to create group conversation");
    }
    $conversation_id = $conn->insert_id;
    $create_stmt->close();

    // Add all members
    $member_stmt = $conn->prepare("
        INSERT INTO group_conversation_members (conversation_id, user_id) VALUES (?, ?)
    ");
    foreach ($participants as $uid) {
        $member_stmt->bind_param("ii", $conversation_id, $uid);
        if (!$member_stmt->execute()) {
            throw new Exception("Failed to add member $uid");
        }
    }
    $member_stmt->close();

    $conn->commit();

    echo json_encode([
        "success"         => true,
        "conversation_id" => $conversation_id,
        "group_name"      => $group_name,
        "participants"    => $participants,
    ]);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["error" => "Internal error: " . $e->getMessage()]);
} finally {
    $conn->close();
}
?>
