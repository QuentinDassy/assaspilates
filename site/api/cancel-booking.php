<?php
/**
 * POST /api/cancel-booking.php
 * Body: { bookingId: uuid }
 *
 * Requires a logged-in client. Calls api_cancel_booking() with the caller's
 * OWN client_id (never trusted from the request body) -- the RPC itself
 * rejects cancelling someone else's booking (NOT_YOUR_BOOKING), verified
 * against the live database in supabase/verification/booking_rpc_verification.sql.
 */

require_once __DIR__ . '/_lib/auth.php';

apbRequireMethod('POST');
$client = apbRequireClient();
$body = apbJsonBody();

$bookingId = (string) ($body['bookingId'] ?? '');
if (!$bookingId) {
    apbJsonError(400, 'invalid_request', 'bookingId is required.');
}

$errorMessages = [
    'BOOKING_NOT_FOUND' => 'Réservation introuvable.',
    'NOT_YOUR_BOOKING' => "Cette réservation n'appartient pas à ce compte.",
    'ALREADY_CANCELLED' => 'Cette réservation est déjà annulée.',
];

try {
    $booking = apbSupabaseRpc('api_cancel_booking', [
        'p_booking_id' => $bookingId,
        'p_actor_client_id' => $client['id'],
        'p_is_admin' => false,
    ]);
} catch (RuntimeException $e) {
    $code = $e->getMessage();
    apbJsonError(422, $code, $errorMessages[$code] ?? 'Impossible d\'annuler cette réservation pour le moment.');
}

apbJsonSuccess($booking);
