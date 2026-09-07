<?php
/**
 * Verifies the Supabase-issued JWT sent by the browser (site/js/auth.js
 * attaches it as "Authorization: Bearer <token>"). Identity/role is always
 * derived from this verified token server-side -- never trusted from a
 * request body field. This closes the "type an email, get in" hole that
 * existed in the old localStorage-based booking/manage.html.
 */

require_once __DIR__ . '/config_loader.php';
require_once __DIR__ . '/supabase.php';
require_once __DIR__ . '/../vendor/autoload.php';

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

function apbBearerToken(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
        return $m[1];
    }
    return null;
}

/** Returns the decoded JWT payload (as array), or null if missing/invalid. */
function apbVerifyJwt(): ?array
{
    $token = apbBearerToken();
    if (!$token) {
        return null;
    }
    $cfg = apbConfig();
    try {
        $decoded = JWT::decode($token, new Key($cfg['SUPABASE_JWT_SECRET'], 'HS256'));
        return (array) $decoded;
    } catch (Exception $e) {
        return null;
    }
}

function apbJsonError(int $status, string $error, string $message = ''): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode(['error' => $error, 'message' => $message]);
    exit;
}

/** Call at the top of any endpoint that requires a logged-in client. Returns the Supabase auth user id (uuid). */
function apbRequireAuth(): string
{
    $payload = apbVerifyJwt();
    if (!$payload || empty($payload['sub'])) {
        apbJsonError(401, 'unauthorized', 'Valid session required.');
    }
    return $payload['sub'];
}

/** Call at the top of any admin-*.php endpoint. Checks the `staff` allow-list table. */
function apbRequireAdmin(): string
{
    $userId = apbRequireAuth();
    $rows = apbSupabaseSelect('staff', '?user_id=eq.' . urlencode($userId) . '&select=role');
    if (empty($rows)) {
        apbJsonError(403, 'forbidden', 'Admin access required.');
    }
    return $userId;
}

/**
 * Temporary Phase 0/1 gate for admin-*.php before real staff auth (Phase 2)
 * lands. Checks a shared secret sent as "X-Admin-Bootstrap-Token". Delete
 * every call site of this function once apbRequireAdmin() is wired up.
 */
function apbRequireBootstrapToken(): void
{
    $cfg = apbConfig();
    $sent = $_SERVER['HTTP_X_ADMIN_BOOTSTRAP_TOKEN'] ?? '';
    if (!hash_equals((string) $cfg['ADMIN_BOOTSTRAP_TOKEN'], (string) $sent)) {
        apbJsonError(403, 'forbidden', 'Invalid bootstrap token.');
    }
}
