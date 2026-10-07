<?php
/**
 * GET  /api/admin-clients.php                      -- list all clients
 * POST /api/admin-clients.php  { action:'update', clientId|email, ... }
 *
 * Requires staff. The student record the admin panel edits ("fiche élève")
 * went nowhere until this existed: saveClientEdit() rewrote the local
 * bookings/carnets arrays in localStorage and said so in its own comment.
 *
 * Two things are kept in step here, on purpose:
 *
 *  - the bookings' name/phone snapshots. They exist so a booking survives the
 *    client row being deleted, not to freeze a typo: correcting "Muriel" in
 *    the fiche is meant to correct it in the réservations list too, which
 *    reads the snapshots. The course snapshots (title, teacher, time) are
 *    deliberately NOT touched -- those really are point-in-time records.
 *
 *  - the Supabase Auth user, when the email changes. clients.email is what
 *    every admin screen joins on, auth.users.email is what the student signs
 *    in with; changing one without the other locks them out of an account
 *    the studio can still see. So the email either changes in both places or
 *    in neither.
 */

require_once __DIR__ . '/_lib/auth.php';

apbRequireAdmin();

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $clients = apbSupabaseSelect('clients', '?select=*&order=created_at.desc');
    apbJsonSuccess(['clients' => $clients]);
}

apbRequireMethod('POST');
$body = apbJsonBody();
$action = (string) ($body['action'] ?? '');

if ($action !== 'update') {
    apbJsonError(400, 'unknown_action', 'Unknown action.');
}

$firstName = trim((string) ($body['firstName'] ?? ''));
$lastName  = trim((string) ($body['lastName'] ?? ''));
$email     = strtolower(trim((string) ($body['email'] ?? '')));
$phone     = trim((string) ($body['phone'] ?? ''));

if ($firstName === '' || $lastName === '' || $email === '') {
    apbJsonError(400, 'invalid_request', 'Prénom, nom et email sont obligatoires.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    apbJsonError(400, 'invalid_email', "L'adresse email n'est pas valide.");
}

// Identify by id when the panel has one, else by the email it is showing.
$clientId = trim((string) ($body['clientId'] ?? ''));
$filter = $clientId !== ''
    ? '?id=eq.' . urlencode($clientId)
    : '?email=ilike.' . urlencode((string) ($body['currentEmail'] ?? $email));

$rows = apbSupabaseSelect('clients', $filter . '&select=*&limit=1');
if (empty($rows)) {
    apbJsonError(404, 'client_not_found', 'Cet élève est introuvable.');
}
$client = $rows[0];

// clients.email is unique: refuse up front rather than surfacing a raw
// Postgres constraint error to the admin.
if (strcasecmp($client['email'], $email) !== 0) {
    $taken = apbSupabaseSelect('clients', '?email=ilike.' . urlencode($email) . '&select=id&limit=1');
    if (!empty($taken) && $taken[0]['id'] !== $client['id']) {
        apbJsonError(409, 'email_taken', 'Un autre élève utilise déjà cette adresse email.');
    }

    // The login first: if Supabase refuses it (address already used by another
    // account there), nothing has moved yet and the two stay consistent.
    if (!empty($client['auth_user_id'])) {
        $res = apbSupabaseRequest('PUT', '/auth/v1/admin/users/' . urlencode($client['auth_user_id']), [
            'email' => $email,
            // Already-verified account whose address the studio is correcting:
            // without this the student would have to confirm a mail sent to an
            // address they may never have had.
            'email_confirm' => true,
        ]);
        if ($res['status'] >= 400) {
            $detail = $res['body']['msg'] ?? ($res['body']['message'] ?? '');
            apbJsonError(422, 'auth_email_refused',
                "L'identifiant de connexion n'a pas pu être changé" . ($detail ? " ({$detail})" : '') . '. Rien n\'a été modifié.');
        }
    }
}

$updated = apbSupabaseUpdate('clients', '?id=eq.' . urlencode($client['id']), [
    'first_name' => $firstName,
    'last_name' => $lastName,
    'email' => $email,
    'phone' => $phone,
]);

// Keep what the admin screens display in step with the fiche (see the header).
apbSupabaseUpdate('bookings', '?client_id=eq.' . urlencode($client['id']), [
    'client_first_name_snapshot' => $firstName,
    'client_last_name_snapshot' => $lastName,
    'client_phone_snapshot' => $phone,
]);

apbJsonSuccess($updated[0] ?? null);
