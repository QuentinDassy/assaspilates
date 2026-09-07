<?php
/**
 * Run hourly via OVH's "Tâches planifiées" (its minimum granularity).
 * Releases any 'awaiting_payment' hold (a booking or carnet whose checkout
 * was abandoned -- closed the tab, card declined with no webhook, etc.)
 * older than 90 minutes: generous margin so an hourly cron never fights an
 * in-progress checkout, since the webhook (site/api/stripe-webhook.php)
 * handles the normal failure path already -- this is strictly a safety net
 * for checkouts that never got a terminal Stripe event at all.
 *
 * Guarded against direct HTTP access: OVH cron invokes PHP scripts via the
 * CLI SAPI, not a web request, so anyone hitting this URL in a browser
 * would otherwise be able to spam-cancel pending payments.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('CLI only.');
}

require_once __DIR__ . '/../api/_lib/auth.php';

$cutoff = (new DateTime('-90 minutes'))->format('c');

$staleBookings = apbSupabaseSelect('bookings',
    '?payment_status=eq.awaiting_payment&status=neq.cancelled&created_at=lt.' . urlencode($cutoff) . '&select=id');
foreach ($staleBookings as $b) {
    try {
        apbSupabaseRpc('api_cancel_booking', ['p_booking_id' => $b['id'], 'p_actor_client_id' => null, 'p_is_admin' => true]);
        apbSupabaseUpdate('bookings', '?id=eq.' . urlencode($b['id']), ['payment_status' => 'failed']);
        echo "Released stale booking hold {$b['id']}\n";
    } catch (Throwable $e) {
        echo "Failed to release booking {$b['id']}: {$e->getMessage()}\n";
    }
}

$staleCarnets = apbSupabaseSelect('carnets',
    '?status=eq.pending_payment&purchased_at=lt.' . urlencode($cutoff) . '&select=id');
foreach ($staleCarnets as $c) {
    apbSupabaseUpdate('carnets', '?id=eq.' . urlencode($c['id']), ['active' => false, 'status' => 'deactivated']);
    echo "Released stale carnet hold {$c['id']}\n";
}

echo 'Done: ' . count($staleBookings) . ' booking(s), ' . count($staleCarnets) . " carnet(s) released.\n";
