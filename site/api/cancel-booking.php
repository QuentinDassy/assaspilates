<?php
/**
 * POST /api/cancel-booking.php
 * Body: { bookingId: uuid }
 *
 * Requires a logged-in client. Calls api_cancel_booking() with the caller's
 * OWN client_id (never trusted from the request body) -- the RPC itself
 * rejects cancelling someone else's booking (NOT_YOUR_BOOKING), verified
 * against the live database in supabase/verification/booking_rpc_verification.sql.
 *
 * Enforces site_settings.cancel_hours server-side (the old localStorage
 * version only hid the cancel button client-side -- easy to bypass by
 * calling the API directly. This check is client-facing only: the admin's
 * own cancel action, admin-bookings.php, intentionally does not apply it).
 *
 * Per the locked refund decision: cancelling a Stripe-paid booking within
 * the allowed window triggers an automatic partial refund of just that
 * booking's amount (not the whole PaymentIntent, which may cover other
 * cart items too) -- no manual admin step.
 */

require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/stripe_client.php';

apbRequireMethod('POST');
$client = apbRequireClient();
$body = apbJsonBody();

$bookingId = (string) ($body['bookingId'] ?? '');
if (!$bookingId) {
    apbJsonError(400, 'invalid_request', 'bookingId is required.');
}

$rows = apbSupabaseSelect('bookings', '?id=eq.' . urlencode($bookingId) . '&select=*');
if (empty($rows)) {
    apbJsonError(422, 'BOOKING_NOT_FOUND', 'Réservation introuvable.');
}
$booking = $rows[0];

$settingsRows = apbSupabaseSelect('site_settings', '?id=eq.1&select=cancel_hours');
$cancelHours = $settingsRows[0]['cancel_hours'] ?? 24;

$courseStart = new DateTime($booking['course_date'] . ' ' . $booking['slot_start_snapshot']);
$hoursLeft = (($courseStart->getTimestamp() - time()) / 3600);
if ($hoursLeft < $cancelHours) {
    apbJsonError(422, 'CANCELLATION_WINDOW_PASSED', "Annulation impossible à moins de {$cancelHours}h du cours. Contactez le studio directement.");
}

$errorMessages = [
    'BOOKING_NOT_FOUND' => 'Réservation introuvable.',
    'NOT_YOUR_BOOKING' => "Cette réservation n'appartient pas à ce compte.",
    'ALREADY_CANCELLED' => 'Cette réservation est déjà annulée.',
];

try {
    $cancelled = apbSupabaseRpc('api_cancel_booking', [
        'p_booking_id' => $bookingId,
        'p_actor_client_id' => $client['id'],
        'p_is_admin' => false,
    ]);
} catch (RuntimeException $e) {
    $code = $e->getMessage();
    apbJsonError(422, $code, $errorMessages[$code] ?? 'Impossible d\'annuler cette réservation pour le moment.');
}

$refunded = false;
if ($booking['payment_type'] === 'stripe' && $booking['payment_status'] === 'paid' && $booking['payment_intent_id']) {
    try {
        apbStripeClient()->refunds->create([
            'payment_intent' => $booking['payment_intent_id'],
            'amount' => (int) $booking['total_paid_cents'],
        ]);
        $refunded = true;
    } catch (Exception $e) {
        // Cancellation itself already succeeded -- surface the refund failure
        // separately rather than rolling back a cancellation that already happened.
    }
}

apbJsonSuccess(array_merge($cancelled, ['refunded' => $refunded]));
