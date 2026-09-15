<?php
session_start();

echo json_encode([
    'csrfToken' => $_SESSION['csrf_token']
]);