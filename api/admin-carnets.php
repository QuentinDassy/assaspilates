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
    $carnets = apbSupabaseSelect('carnets', '?order=purchased_at.desc&limit=500');
    apbJsonSuccess(['carnets' => $carnets]);
}

apbRequireMethod('POST');
$body = apbJsonBody();
$action = (string) ($body['action'] ?? '');

function apbFindOrCreateClientByEmail(string $email, string $firstName, string $lastName, string $phone): array
{
    $email = strtolower(trim($email));
    $existing = apbSupabaseSelect('clients', '?email=eq.' . urlencode($email) . '&select=id,email');
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

    $code = 'APB-' . strtoupper(bin2hex(random_bytes(2))) . '-' . strtoupper(bin2hex(random_bytes(2)));
    $expiresAt = (new DateTime())->modify("+{$validityMonths} months")->format('Y-m-d');

    $carnet = apbSupabaseInsert('carnets', [
        'code' => $code,
        'client_id' => $client['id'],
        'tarif_id' => $tarifId,
        'tarif_name_snapshot' => $tarifName,
        'type' => $type,
        'total_sessions' => $sessionCount,
        'remaining_sessions' => $sessionCount,
        'validity_months' => $validityMonths,
        'expires_at' => $expiresAt,
        'total_paid_cents' => $totalPaidCents,
        'status' => 'active',
    ]);

    apbJsonSuccess($carnet, 201);
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
