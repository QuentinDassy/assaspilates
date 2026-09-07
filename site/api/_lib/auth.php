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
use Firebase\JWT\JWK;

function apbBearerToken(): ?string
{
    // Apache+PHP as CGI/FastCGI (OVH shared hosting) doesn't reliably surface
    // the Authorization header in $_SERVER even with the api/.htaccess
    // rewrite -- check every source PHP might expose it through.
    $header = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? '';
    if (!$header && function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strcasecmp($name, 'Authorization') === 0) {
                $header = $value;
                break;
            }
        }
    }
    if (preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
        return $m[1];
    }
    return null;
}

/**
 * Fetches Supabase's public JWKS (this project signs with an asymmetric
 * ES256/ECC key, not a shared HS256 secret -- verifying against the public
 * key means no secret is needed here at all, and rotation just works since
 * the JWKS always lists the current key(s)). File-cached for an hour next
 * to this script (inside the .htaccess-protected _lib/ dir) so we're not
 * hitting Supabase's endpoint on every single API request.
 */
function apbFetchJwks(): array
{
    $cachePath = __DIR__ . '/jwks_cache.json';
    if (file_exists($cachePath) && (time() - filemtime($cachePath)) < 3600) {
        $cached = json_decode((string) file_get_contents($cachePath), true);
        if (is_array($cached)) {
            return $cached;
        }
    }

    $cfg = apbConfig();
    $ch = curl_init(rtrim($cfg['SUPABASE_URL'], '/') . '/auth/v1/.well-known/jwks.json');
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
    $raw = curl_exec($ch);
    curl_close($ch);

    $jwks = $raw ? json_decode($raw, true) : null;
    if (is_array($jwks)) {
        @file_put_contents($cachePath, $raw);
        return $jwks;
    }
    // Fetch failed -- fall back to a stale cache if we have one, rather than
    // hard-failing every request during a transient network blip.
    if (file_exists($cachePath)) {
        $cached = json_decode((string) file_get_contents($cachePath), true);
        if (is_array($cached)) {
            return $cached;
        }
    }
    return ['keys' => []];
}

/** Returns the decoded JWT payload (as array), or null if missing/invalid. */
function apbVerifyJwt(): ?array
{
    $token = apbBearerToken();
    if (!$token) {
        return null;
    }
    try {
        // Small clock-skew tolerance: without it, a token verified within a
        // couple seconds of being issued can intermittently fail iat/nbf
        // checks if this server's clock trails Supabase's by even ~1-2s.
        JWT::$leeway = 10;
        $keySet = JWK::parseKeySet(apbFetchJwks());
        $decoded = JWT::decode($token, $keySet);
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
 * Call at the top of any endpoint acting on behalf of a client (booking,
 * cancelling, viewing their own data). Resolves the verified auth user id to
 * their `clients` row (id, email, first_name, last_name, phone) -- every
 * downstream query uses this client_id, never one taken from the request body.
 */
function apbRequireClient(): array
{
    $userId = apbRequireAuth();
    $rows = apbSupabaseSelect('clients', '?auth_user_id=eq.' . urlencode($userId) . '&select=id,email,first_name,last_name,phone');
    if (empty($rows)) {
        // The signup trigger (0002_auth.sql) creates this row automatically;
        // getting here means something is wrong server-side, not a client error.
        apbJsonError(500, 'client_not_found', 'No client record linked to this account.');
    }
    return $rows[0];
}

/**
 * Finds a `clients` row by email, or creates a guest one (no auth_user_id)
 * if none exists yet -- the same pattern the auth.users signup trigger uses
 * (0002_auth.sql), so if a guest later signs up with the same email, that
 * trigger's ON CONFLICT links it to this same row instead of duplicating it.
 * Shared by admin-carnets.php (granting a carnet to a non-signed-up email)
 * and create-payment-intent.php (guest unit-course checkout).
 */
function apbFindOrCreateClientByEmail(string $email, string $firstName = '', string $lastName = '', string $phone = ''): array
{
    $email = strtolower(trim($email));
    $existing = apbSupabaseSelect('clients', '?email=eq.' . urlencode($email) . '&select=id,email,first_name,last_name,phone');
    if (!empty($existing)) {
        return $existing[0];
    }
    return apbSupabaseInsert('clients', [
        'email' => $email,
        'first_name' => $firstName,
        'last_name' => $lastName,
        'phone' => $phone,
    ]);
}

function apbJsonSuccess($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

/** Reads and JSON-decodes the request body; empty array if missing/invalid. */
function apbJsonBody(): array
{
    $raw = file_get_contents('php://input');
    $decoded = $raw ? json_decode($raw, true) : null;
    return is_array($decoded) ? $decoded : [];
}

function apbRequireMethod(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) {
        apbJsonError(405, 'method_not_allowed', "Expected {$method}.");
    }
}
