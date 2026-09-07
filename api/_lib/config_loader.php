<?php
/**
 * Loads config.php (gitignored, holds secrets) and fails loudly if it's
 * missing rather than falling back to placeholder values -- a booking/
 * payment endpoint must never silently run against fake credentials.
 */

function apbConfig(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $path = __DIR__ . '/config.php';
    if (!file_exists($path)) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'server_misconfigured', 'message' => 'config.php missing -- copy config.php.example and fill it in, or run the deploy workflow.']);
        exit;
    }

    $config = require $path;
    return $config;
}
