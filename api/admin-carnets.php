<?php
/**
 * GET  /api/admin-carnets.php                              -- list all carnets
 * POST /api/admin-carnets.php  { action:'create', ... }     -- manually grant a carnet
 * POST /api/admin-carnets.php  { action:'deactivate', carnetId }
 *
 * Requires staff. "create" finds-or-creates the `clients` row by email (a
 * carnet can be granted to someone who has never signed up -- same
 * find-or-create-by-email pattern as the auth.users trigger in
 * 0002_auth.sql, so if they sign up later with that email it links up).
 */

require_once __DIR__ . '/_lib/auth.php';

apbRequireAdmin();

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    // carnets has no client name/email/phone columns (only client_id) --
    // embed the related clients row so the admin UI doesn't need a 2nd call per row.
    $carnets = apbSupabaseSelect('carnets', '?select=*,clients(email,first_name,last_name,phone)&order=purchased_at.desc&limit=500');
    apbJsonSuccess(['carnets' => $carnets]);
}

apbRequireMethod('POST');
$body = apbJsonBody();
$action = (string) ($body['action'] ?? '');
// apbFindOrCreateClientByEmail() lives in _lib/auth.php (shared with create-payment-intent.php's guest checkout path).

if ($action === 'create') {
    $email = (string) ($body['email'] ?? '');
    $firstName = (string) ($body['firstName'] ?? '');
    $lastName = (string) ($body['lastName'] ?? '');
    $phone = (string) ($body['phone'] ?? '');
    $tarifId = isset($body['tarifId']) ? (int) $body['tarifId'] : null;
    $tarifName = (string) ($body['tarifName'] ?? '');
    $type = (string) ($body['type'] ?? '');
    $sessionCount = isset($body['sessionCount']) ? (int) $body['sessionCount'] : 0;
    $validityMonths = isset($body['validityMonths']) ? (int) $body['validityMonths'] : 0;
    $totalPaidCents = isset($body['totalPaidCents']) ? (int) $body['totalPaidCents'] : 0;

    if (!$email || !$tarifName || !$type || $sessionCount <= 0 || $validityMonths <= 0) {
        apbJsonError(400, 'invalid_request', 'email, tarifName, type, sessionCount and validityMonths are required.');
    }

    $client = apbFindOrCreateClientByEmail($email, $firstName, $lastName, $phone);

    // Defaults to a fresh carnet (remaining = total), but the admin can grant
    // one with sessions already used up (e.g. recreating a paper carnet a
    // client already partly used) -- clamped so it can never exceed the total
    // or go negative.
    $remainingSessions = isset($body['remainingSessions']) ? (int) $body['remainingSessions'] : $sessionCount;
    $remainingSessions = max(0, min($sessionCount, $remainingSessions));

    $code = 'APB-' . strtoupper(bin2hex(random_bytes(2))) . '-' . strtoupper(bin2hex(random_bytes(2)));
    $expiresAt = (new DateTime())->modify("+{$validityMonths} months")->format('Y-m-d');

    $carnet = apbSupabaseInsert('carnets', [
        'code' => $code,
        'client_id' => $client['id'],
        'tarif_id' => $tarifId,
        'tarif_name_snapshot' => $tarifName,
        'type' => $type,
        'total_sessions' => $sessionCount,
        'remaining_sessions' => $remainingSessions,
        'validity_months' => $validityMonths,
        'expires_at' => $expiresAt,
        'total_paid_cents' => $totalPaidCents,
        'status' => 'active',
    ]);

    apbJsonSuccess($carnet, 201);
}

if ($action === 'update') {
    $carnetId = (string) ($body['carnetId'] ?? '');
    if (!$carnetId) {
        apbJsonError(400, 'invalid_request', 'carnetId is required.');
    }
    $patch = [];
    if (isset($body['sessionCount'])) $patch['total_sessions'] = (int) $body['sessionCount'];
    if (isset($body['remainingSessions'])) $patch['remaining_sessions'] = (int) $body['remainingSessions'];
    if (isset($body['expiresAt']) && $body['expiresAt'] !== '') $patch['expires_at'] = (string) $body['expiresAt'];
    if (isset($body['active'])) $patch['active'] = (bool) $body['active'];

    // Editing the client's email re-points the carnet at a (possibly new) client row.
    if (!empty($body['email'])) {
        $client = apbFindOrCreateClientByEmail(
            (string) $body['email'],
            (string) ($body['firstName'] ?? ''),
            (string) ($body['lastName'] ?? ''),
            (string) ($body['phone'] ?? '')
        );
        $patch['client_id'] = $client['id'];
    }

    if (empty($patch)) {
        apbJsonError(400, 'invalid_request', 'Nothing to update.');
    }
    $updated = apbSupabaseUpdate('carnets', '?id=eq.' . urlencode($carnetId), $patch);
    apbJsonSuccess($updated[0] ?? null);
}

if ($action === 'deactivate') {
    $carnetId = (string) ($body['carnetId'] ?? '');
    if (!$carnetId) {
        apbJsonError(400, 'invalid_request', 'carnetId is required.');
    }
    $updated = apbSupabaseUpdate('carnets', '?id=eq.' . urlencode($carnetId), [
        'active' => false,
        'status' => 'deactivated',
    ]);
    apbJsonSuccess($updated[0] ?? null);
}

apbJsonError(400, 'unknown_action', 'Unknown action.');
