<?php
/**
 * POST /api/cancel-pending-payment.php
 * Body: { paymentIntentId: string }
 *
 * Lets the browser release its own still-unpaid hold right away when
 * stripe.confirmCardPayment() reports an error client-side (declined card,
 * bad publishable key, network failure...), instead of leaving the booking/
 * carnet sitting as "awaiting_payment"/"pending_payment" until
 * site/scheduled/release-payment-holds.php's hourly 90-minute sweep gets to
 * it. Purely a freshness improvement -- site/api/stripe-webhook.php's
 * payment_intent.payment_failed handler and that cron remain the
 * authoritative cleanup paths for any client that never calls this at all
 * (e.g. the tab is closed mid-payment).
 *
 * No auth required: guest unit-course checkout has no session to require,
 * and knowing a PaymentIntent id only ever lets you release a hold that is
 * still unpaid a little earlier than the cron would have anyway -- it can
 * never touch a booking/carnet that already succeeded (checked below).
 */

require_once __DIR__ . '/_lib/auth.php';

apbRequireMethod('POST');
$body = apbJsonBody();
$paymentIntentId = (string) ($body['paymentIntentId'] ?? '');
if (!$paymentIntentId) {
    apbJsonError(400, 'invalid_request', 'paymentIntentId is required.');
}

$piRows = apbSupabaseSelect('payment_intents', '?id=eq.' . urlencode($paymentIntentId) . '&select=id,kind,status,metadata');
if (empty($piRows) || $piRows[0]['status'] === 'succeeded') {
    // Unknown id, or already paid (webhook beat this call, or the client is
    // wrong about its own payment having failed) -- never touch it.
    apbJsonSuccess(['released' => false]);
}
$pi = $piRows[0];

if ($pi['kind'] === 'booking') {
    $ids = $pi['metadata']['booking_ids'] ?? [];
    foreach ($ids as $id) {
        try {
            apbSupabaseRpc('api_cancel_booking', ['p_booking_id' => $id, 'p_actor_client_id' => null, 'p_is_admin' => true]);
        } catch (Throwable $e) {
            // Already cancelled (webhook or the cron beat this call) -- fine.
        }
        apbSupabaseUpdate('bookings', '?id=eq.' . urlencode($id), ['payment_status' => 'failed']);
    }
} elseif ($pi['kind'] === 'carnet') {
    $carnetId = $pi['metadata']['carnet_id'] ?? '';
    if ($carnetId) {
        apbSupabaseUpdate('carnets', '?id=eq.' . urlencode($carnetId), ['active' => false, 'status' => 'deactivated']);
    }
}
apbSupabaseUpdate('payment_intents', '?id=eq.' . urlencode($paymentIntentId), ['status' => 'canceled']);

apbJsonSuccess(['released' => true]);
