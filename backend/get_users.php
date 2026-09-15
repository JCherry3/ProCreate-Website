<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET");
header("Access-Control-Allow-Headers: Content-Type");

require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    exit(json_encode(["error" => "Database connection failed"]));
}

// Base URL � no trailing slash
$baseUrl = "/CSE442/2026-Spring/cse-442y";

$query = "
    SELECT 
        p.user_id,
        p.`first name`  AS first_name, 
        p.`last name`   AS last_name, 
        p.username, 
        ui.bio, 
        ui.followers,
        ui.pic,
        (SELECT COUNT(*) FROM projects WHERE publisher_id = p.user_id) AS project_count
    FROM profile p
    INNER JOIN user_info ui ON p.user_id = ui.user_id
";

$result = $conn->query($query);

if (!$result) {
    http_response_code(500);
    echo json_encode(["error" => "Query failed: " . $conn->error]);
    $conn->close();
    exit;
}

$users = [];

while ($row = $result->fetch_assoc()) {
    // Build combined name
    $row['name'] = trim($row['first_name'] . " " . $row['last_name']);
    unset($row['first_name'], $row['last_name']);

    // Build pic URL
    // DB stores values like: "profile_pics/user_14_1772230085.png"
    // We want:               "/CSE442/2026-Spring/cse-442y/api/profile_pics/user_14_1772230085.png"
    if (!empty($row['pic'])) {
        $pic = trim($row['pic']);
        // Strip any leading slashes so we can prepend cleanly
        $pic = ltrim($pic, '/');
        // If the DB value already includes "profile_pics/..." but not the "api/" prefix, add it
        // If it already starts with "api/", don't double it
        if (strpos($pic, 'api/') !== 0) {
            $pic = 'api/' . $pic;
        }
        $row['pic'] = $baseUrl . '/' . $pic;
    } else {
        $row['pic'] = null;
    }

    // Cast numeric fields
    $decoded = json_decode($row['followers'], true);
    $row['followers'] = is_array($decoded) ? count($decoded) : 0;
    $row['project_count'] = (int) $row['project_count'];

    $users[] = $row;
}

echo json_encode($users);
$conn->close();