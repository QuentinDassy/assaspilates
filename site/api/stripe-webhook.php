<?php
/**
 * POST /api/stripe-webhook.php  (called by Stripe, not the browser)
 *
 * The ONLY place that ever marks a booking/carnet as paid -- the client's
 * own "confirmCardPayment succeeded" claim is advisory UI only. Verifies
 * the Stripe-Signature header against the raw body before trusting anything.
 *
 * payment_intent.succeeded:
 *   kind=booking -> flip payment_status='paid' on every booking listed in
 *     metadata.booking_ids (the collectif pending/confirmed transition
 *     already happened at hold-creation time in api_book_slot(), so `status`
 *     itself doesn't change here -- only `payment_status`).
 *   kind=carnet  -> activate the carnet (remaining_sessions = total_sessions,
 *     active=true, status='active'). It was created with remaining_sessions=0
 *     specifically so it can't be used before this happens.
 *
 * payment_intent.payment_failed / payment_intent.canceled:
 *   kind=booking -> release each hold via api_cancel_booking() (the same
 *     row-locked RPC the client-facing cancel flow uses), freeing the spot.
 *   kind=carnet  -> mark the carnet 'deactivated' (it was never usable).
 *
 * Idempotent by construction: re-applying "set payment_status='paid'" or
 * "activate this carnet" a second time (Stripe retries deliveries) has the
 * same effect as the first time.
 */

require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/stripe_client.php';

$cfg = apbConfig();
$payload = file_get_contents('php://input');
$sigHeader = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

try {
    $event = \Stripe\Webhook::constructEvent($payload, $sigHeader, $cfg['STRIPE_WEBHOOK_SECRET']);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_signature']);
    exit;
}

/**
 * A composite formula is sold as several carnets under one charge
 * (0008_decouverte_formula.sql), so the id list is what metadata carries now.
 * `carnet_id` is still read for PaymentIntents created before that change and
 * still in flight when it deployed.
 */
function apbCarnetIdsFromMetadata(array $pi): array
{
    $ids = $pi['metadata']['carnet_ids'] ?? ($pi['metadata']['carnet_id'] ?? '');
    return array_filter(array_map('trim', explode(',', (string) $ids)));
}

function apbHandlePaymentSucceeded(array $pi): void
{
    $kind = $pi['metadata']['kind'] ?? '';
    if ($kind === 'booking') {
        $ids = array_filter(explode(',', $pi['metadata']['booking_ids'] ?? ''));
        foreach ($ids as $id) {
            apbSupabaseUpdate('bookings', '?id=eq.' . urlencode($id), ['payment_status' => 'paid']);
        }
    } elseif ($kind === 'carnet') {
        foreach (apbCarnetIdsFromMetadata($pi) as $carnetId) {
            $rows = apbSupabaseSelect('carnets', '?id=eq.' . urlencode($carnetId) . '&select=total_sessions');
            $totalSessions = $rows[0]['total_sessions'] ?? 0;
            apbSupabaseUpdate('carnets', '?id=eq.' . urlencode($carnetId), [
                'remaining_sessions' => $totalSessions, 'active' => true, 'status' => 'active',
            ]);
        }
    }
    apbSupabaseUpdate('payment_intents', '?id=eq.' . urlencode($pi['id']), ['status' => 'succeeded']);
}

function apbHandlePaymentFailedOrCanceled(array $pi): void
{
    $kind = $pi['metadata']['kind'] ?? '';
    if ($kind === 'booking') {
        $ids = array_filter(explode(',', $pi['metadata']['booking_ids'] ?? ''));
        foreach ($ids as $id) {
            try {
                apbSupabaseRpc('api_cancel_booking', ['p_booking_id' => $id, 'p_actor_client_id' => null, 'p_is_admin' => true]);
            } catch (Throwable $e) {
                // Already cancelled (e.g. cleanup-stale-holds.php beat the webhook to it) -- fine.
            }
            apbSupabaseUpdate('bookings', '?id=eq.' . urlencode($id), ['payment_status' => 'failed']);
        }
    } elseif ($kind === 'carnet') {
        foreach (apbCarnetIdsFromMetadata($pi) as $carnetId) {
            apbSupabaseUpdate('carnets', '?id=eq.' . urlencode($carnetId), ['active' => false, 'status' => 'deactivated']);
        }
    }
    apbSupabaseUpdate('payment_intents', '?id=eq.' . urlencode($pi['id']), ['status' => $pi['status'] ?? 'failed']);
}

$obj = $event->data->object->toArray();

// Sanity check: only act on PaymentIntents we actually created (defense in
// depth beyond the signature check -- ignores unrelated/malformed events).
$known = apbSupabaseSelect('payment_intents', '?id=eq.' . urlencode($obj['id']) . '&select=id');
if (empty($known)) {
    http_response_code(200); // acknowledge so Stripe doesn't keep retrying an event we'll never recognize
    echo json_encode(['ignored' => true]);
    exit;
}

switch ($event->type) {
    case 'payment_intent.succeeded':
        apbHandlePaymentSucceeded($obj);
        break;
    case 'payment_intent.payment_failed':
    case 'payment_intent.canceled':
        apbHandlePaymentFailedOrCanceled($obj);
        break;
}

http_response_code(200);
echo json_encode(['received' => true]);
