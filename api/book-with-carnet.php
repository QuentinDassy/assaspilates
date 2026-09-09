<?php
/**
 * POST /api/book-with-carnet.php
 * Body: { slotId: int, courseDate: "YYYY-MM-DD", carnetId: uuid, participants?: int, message?: string }
 *
 * Requires a logged-in client (JWT). Books a slot occurrence using an
 * existing carnet -- calls api_book_slot() (supabase/migrations/0003_bookings.sql),
 * which does the whole thing (capacity check, carnet deduction, the
 * collectif "wait for 2nd student" transition) inside one Postgres
 * transaction with a row lock, so concurrent requests for the same
 * slot+date can never double-book or double-deduct.
 */

require_once __DIR__ . '/_lib/auth.php';

apbRequireMethod('POST');
$client = apbRequireClient();
$body = apbJsonBody();

$slotId = isset($body['slotId']) ? (int) $body['slotId'] : 0;
$courseDate = (string) ($body['courseDate'] ?? '');
$carnetId = (string) ($body['carnetId'] ?? '');
// Always exactly 1 -- a carnet session covers its own holder, not a
// plus-one, and the RPC only ever deducts 1 session regardless of this
// value, so trusting a client-supplied participants > 1 here would let
// someone claim extra slot_occurrences capacity for free (supabase/migrations/0004_participants_capacity.sql
// made capacity scale with this value, which is exactly what makes that
// mismatch exploitable).
$participants = 1;
$message = isset($body['message']) ? (string) $body['message'] : null;

if (!$slotId || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $courseDate) || !$carnetId) {
    apbJsonError(400, 'invalid_request', 'slotId, courseDate (YYYY-MM-DD) and carnetId are required.');
}

// User-facing French translations for the RPC's RAISE EXCEPTION codes.
$errorMessages = [
    'SLOT_NOT_FOUND' => "Ce cours n'existe pas ou n'est plus disponible.",
    'CLIENT_NOT_FOUND' => 'Compte introuvable. Reconnectez-vous et réessayez.',
    'SLOT_CANCELLED' => "Ce créneau a été annulé.",
    'SLOT_FULL' => 'Ce cours est complet.',
    'TEACHER_ABSENT' => "Le professeur n'est pas disponible à cette date (absence/vacances).",
    'BOOKING_TOO_LATE' => "Les réservations ferment 1h avant le début du cours.",
    'CARNET_REQUIRED' => 'Sélectionnez un carnet.',
    'CARNET_INVALID_OR_DEPLETED' => "Ce carnet n'est pas valable pour ce cours (épuisé, expiré, ou ne correspond pas au type de cours).",
];

try {
    $booking = apbSupabaseRpc('api_book_slot', [
        'p_client_id' => $client['id'],
        'p_slot_id' => $slotId,
        'p_course_date' => $courseDate,
        'p_payment_type' => 'carnet',
        'p_carnet_id' => $carnetId,
        'p_total_paid_cents' => 0,
        'p_payment_status' => 'paid',
        'p_client_message' => $message,
        'p_participants' => $participants,
    ]);
} catch (RuntimeException $e) {
    $code = $e->getMessage();
    apbJsonError(422, $code, $errorMessages[$code] ?? 'Impossible de réserver ce cours pour le moment.');
}

apbJsonSuccess($booking);
