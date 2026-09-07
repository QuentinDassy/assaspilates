<?php
/**
 * POST /api/update-profile.php
 * Body: { firstName, lastName, phone }
 *
 * Requires a logged-in client. The `clients` row created by the auth.users
 * signup trigger (0002_auth.sql) only has `email` -- Supabase Auth signup
 * itself has no concept of first/last name -- so this fills in the rest
 * right after signup. Without it, every booking's client_*_snapshot fields
 * (populated from `clients` inside api_book_slot()) would be blank.
 */

require_once __DIR__ . '/_lib/auth.php';

apbRequireMethod('POST');
$client = apbRequireClient();
$body = apbJsonBody();

$firstName = trim((string) ($body['firstName'] ?? ''));
$lastName = trim((string) ($body['lastName'] ?? ''));
$phone = trim((string) ($body['phone'] ?? ''));

$patch = [];
if ($firstName !== '') $patch['first_name'] = $firstName;
if ($lastName !== '') $patch['last_name'] = $lastName;
if ($phone !== '') $patch['phone'] = $phone;

if (empty($patch)) {
    apbJsonSuccess($client);
}

$updated = apbSupabaseUpdate('clients', '?id=eq.' . urlencode($client['id']), $patch);
apbJsonSuccess($updated[0] ?? $client);
