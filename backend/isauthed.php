<?php
session_start();

if (isset($_SESSION['auth_token']) && isset($_SESSION['user_id'])) {
    echo json_encode(['isAuthed' => true]);
} else {
    echo json_encode(['isAuthed' => false]);
}
?>