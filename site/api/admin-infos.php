<?php
/**
 * GET  /api/admin-infos.php            -- the single site_settings row
 * POST /api/admin-infos.php  { ... }   -- update it
 *
 * Requires staff. site_settings holds the address, phone, Instagram handle
 * and the two booking rules shown on the site (cancel_hours, late_minutes).
 * Like the Tarifs tab, the Infos tab wrote to localStorage only until this
 * existed -- "✓ Informations enregistrées. Visibles sur le site." was true
 * of exactly one browser.
 *
 * The table is a single row pinned to id = 1 by its own CHECK, so this only
 * ever updates; there is nothing to create or delete.
 */

require_once __DIR__ . '/_lib/auth.php';

apbRequireAdmin();

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $rows = apbSupabaseSelect('site_settings', '?id=eq.1');
    apbJsonSuccess(['infos' => $rows[0] ?? null]);
}

apbRequireMethod('POST');
$body = apbJsonBody();

$email = trim((string) ($body['email'] ?? ''));
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    apbJsonError(400, 'invalid_email', "L'adresse email n'est pas valide.");
}

// Both delays are shown to clients and drive the cancellation rules, so they
// are clamped rather than trusted: a negative cancel_hours would let someone
// cancel after the course, and the column is `not null` anyway.
$cancelHours = isset($body['cancelHours']) ? (int) $body['cancelHours'] : 24;
$lateMinutes = isset($body['retardMin']) ? (int) $body['retardMin'] : 10;

$patch = [
    'addr1' => (string) ($body['addr1'] ?? ''),
    'addr2' => (string) ($body['addr2'] ?? ''),
    'phone' => (string) ($body['tel'] ?? ''),
    'email' => $email,
    'instagram' => (string) ($body['instagram'] ?? ''),
    'cancel_hours' => max(0, min(168, $cancelHours)),
    'late_minutes' => max(0, min(120, $lateMinutes)),
    'punctuality_message' => (string) ($body['ponctMsg'] ?? ''),
    'updated_at' => gmdate('c'),
];

$updated = apbSupabaseUpdate('site_settings', '?id=eq.1', $patch);
apbJsonSuccess($updated[0] ?? null);
