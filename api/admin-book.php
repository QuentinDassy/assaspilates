<?php
/**
 * POST /api/admin-book.php
 * Body: { clientEmail: string, slotId: int, courseDate: "YYYY-MM-DD" }
 *
 * Staff-only. Registers an EXISTING client into a slot occurrence, recorded
 * as paid on site (payment_type 'onsite' -- see
 * supabase/migrations/0009_onsite_payment.sql). Reuses api_book_slot(), the
 * same transactional path as the client booking flows, so capacity, teacher
 * absence and the 1h cutoff are all enforced here too and an admin booking
 * can never double-book or exceed capacity.
 *
 * Price is the slot's own price_cents (already derived from the type's unit
 * tarif when the slot was created), never taken from the request.
 */

require_once __DIR__ . '/_lib/auth.php';

apbRequireAdmin();
apbRequireMethod('POST');
$body = apbJsonBody();

$clientEmail = trim((string) ($body['clientEmail'] ?? ''));
$slotId      = isset($body['slotId']) ? (int) $body['slotId'] : 0;
$courseDate  = (string) ($body['courseDate'] ?? '');

if ($clientEmail === '' || !$slotId || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $courseDate)) {
    apbJsonError(400, 'invalid_request', 'clientEmail, slotId et courseDate (YYYY-MM-DD) sont requis.');
}

// The RPC needs a client_id, and only an existing account can be booked --
// a brand-new student must sign up first. Case-insensitive match on email.
$clientRows = apbSupabaseSelect('clients', '?email=ilike.' . urlencode($clientEmail) . '&select=id&limit=1');
if (empty($clientRows)) {
    apbJsonError(404, 'client_not_found', "Aucun compte client pour cet email — l'élève doit d'abord créer un compte sur le site.");
}
$clientId = $clientRows[0]['id'];

// Price comes from the slot itself (set server-side from the type's unit
// tarif at creation), so an "onsite" booking records what the studio charged.
$slotRows = apbSupabaseSelect('slots', '?id=eq.' . $slotId . '&select=price_cents');
if (empty($slotRows)) {
    apbJsonError(404, 'slot_not_found', "Ce cours n'existe pas.");
}
$priceCents = (int) ($slotRows[0]['price_cents'] ?? 0);

// User-facing French translations for the RPC's RAISE EXCEPTION codes.
$errorMessages = [
    'SLOT_NOT_FOUND'   => "Ce cours n'existe pas ou n'est plus disponible.",
    'CLIENT_NOT_FOUND' => 'Compte client introuvable.',
    'SLOT_CANCELLED'   => "Ce créneau a été annulé.",
    'SLOT_FULL'        => 'Ce cours est complet.',
    'TEACHER_ABSENT'   => "Le professeur n'est pas disponible à cette date (absence/vacances).",
    'BOOKING_TOO_LATE' => "Les réservations ferment 1h avant le début du cours.",
];

try {
    $booking = apbSupabaseRpc('api_book_slot', [
        'p_client_id'        => $clientId,
        'p_slot_id'          => $slotId,
        'p_course_date'      => $courseDate,
        'p_payment_type'     => 'onsite',
        'p_carnet_id'        => null,
        'p_total_paid_cents' => $priceCents,
        'p_payment_status'   => 'paid',
        'p_client_message'   => null,
        'p_participants'     => 1,
    ]);
} catch (RuntimeException $e) {
    $code = $e->getMessage();
    apbJsonError(422, $code, $errorMessages[$code] ?? "Impossible d'inscrire l'élève à ce cours.");
}

apbJsonSuccess($booking);
