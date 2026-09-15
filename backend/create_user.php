<?php
session_start();
header("Content-Type: application/json");

// Database connection
require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed"]);
    exit;
}

// Get JSON input
$input = json_decode(file_get_contents("php://input"), true);

// Validate input
$required = [
    "first_name",
    "last_name",
    "username",
    "email",
    "password",
];

foreach ($required as $field) {
    if (empty($input[$field])) {
        http_response_code(400);
        echo json_encode(["error" => "$field is required"]);
        exit;
    }
}

$firstName  = $input["first_name"];
$lastName   = $input["last_name"];
$username   = $input["username"];
$email      = $input["email"];
$password   = $input["password"];

// Verify email address is valid
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid email address"]);
    exit;
}

// Hash password
$hashedPassword = password_hash($password, PASSWORD_DEFAULT);

// Generate auth token
// Use a large positive integer within 32-bit signed range
$authToken = random_int(1000000000, 2147483647);

// Insert user
$stmt = $conn->prepare(
    "INSERT INTO profile (`first name`, `last name`, `username`, `email`, `password`, `auth_token`, `date`)
     VALUES (?, ?, ?, ?, ?, ?, ?)"
);

// Date account created
$date = time();

// i: int
// d: double
// s: string
// b: blob
$stmt->bind_param(
    "sssssii",
    $firstName,
    $lastName,
    $username,
    $email,
    $hashedPassword,
    $authToken,
    $date
);

if ($stmt->execute()) {
    $user_id = $stmt->insert_id;
    
    // Store auth token and user_id in session
    $_SESSION['auth_token'] = $authToken;
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32)); // Generate CSRF token for future requests
    $_SESSION['user_id'] = $user_id;
    
    $stmt2 = $conn->prepare("INSERT INTO user_info (user_id, location, followers, following, bio, company, job, pic, website, showEmail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $emptyString = '';
    $default_location = 'Not Shared';
    $zero = 0;
    $stmt2->bind_param(
        "isiisssssi",
        $user_id,
        $default_location,
        $zero,
        $zero,
        $emptyString,
        $emptyString,
        $emptyString,
        $emptyString,
        $emptyString,
        $zero
    );
    $stmt2->execute();
    $stmt2->close();
    http_response_code(201);
    echo json_encode([
        "message" => "User created successfully",
        "user_id" => $user_id
    ]);
} else {
    http_response_code(500);
    echo json_encode(["error" => "User creation failed"]);
}

$stmt->close();
$conn->close();
