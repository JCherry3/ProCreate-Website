<?php
session_start();

// Database connection (same as password_reset.php)
require 'config.php';
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    die('Database connection failed');
}


if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $token = $_GET['token'] ?? null;
    $user_id = $_GET['user_id'] ?? null;

    if (!$token || !$user_id) {
        die('Invalid request.');
    }

    // Verify token against database
    $stmt = $conn->prepare('SELECT user_id FROM profile WHERE user_id = ? AND reset_token = ?');
    $stmt->bind_param('is', $user_id, $token);
    $stmt->execute();
    $stmt->store_result();
    $user = null;
    if ($stmt->num_rows > 0) {
        $user = $user_id; // we just need to know it exists
    }

    if (!$user) {
        die('Invalid or expired token.');
    }

    $_SESSION['reset_user_id'] = $user_id;
    $_SESSION['reset_token'] = $token;
?>
<!DOCTYPE html>
<html>
<head>
    <title>Reset Password</title>
</head>
<body>
    <h2>Reset Password</h2>
    <form method="POST">
        <input type="password" name="password" placeholder="New password" required>
        <input type="password" name="confirm_password" placeholder="Confirm password" required>
        <button type="submit">Reset Password</button>
    </form>
</body>
</html>
<?php
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user_id = $_SESSION['reset_user_id'] ?? null;
    $token = $_SESSION['reset_token'] ?? null;
    $password = $_POST['password'] ?? null;
    $confirm_password = $_POST['confirm_password'] ?? null;

    if (!$user_id || !$token || $password !== $confirm_password) {
        die('Invalid request or passwords do not match.');
    }

    // Update password
    $hashed_password = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $conn->prepare('UPDATE profile SET password = ?, reset_token = NULL WHERE user_id = ?');
    $stmt->bind_param('si', $hashed_password, $user_id);
    $stmt->execute();
    session_destroy();
    echo 'Password reset successfully.';
}
?>