<?php
/**
 * POST /api/create-payment-intent.php
 *
 * Two kinds, sharing one PaymentIntent-then-webhook-confirms flow:
 *
 *   { kind: 'booking', cartItems: [{slotId, courseDate, participants?, message?}],
 *     guest?: {email, firstName, lastName, phone} }
 *   -- Unit-course booking. Logged in -> uses that client. Not logged in ->
 *      guest checkout (per the locked decision: a one-off unit booking needs
 *      no account), using `guest.email` to find-or-create a `clients` row.
 *
 *   { kind: 'carnet', tarifId }
 *   -- Carnet purchase. Always requires a logged-in client (a carnet tracks
 *      an ongoing balance, so it always needs a real account).
 *
 * Both hold their capacity/carnet-slot BEFORE payment succeeds (bookings via
 * api_book_slot() with payment_status='awaiting_payment', same row-locked
 * transaction as the carnet-payment path; a new carnet starts at
 * remaining_sessions=0 so it can't be used until paid) and return a Stripe
 * clientSecret for the browser to confirm. site/api/stripe-webhook.php is
 * the ONLY place that flips payment_status to 'paid' -- the client's own
 * "it succeeded" claim is never trusted. Prices are always looked up
 * server-side from `slots`/`tarifs`, never taken from the request body.
 */

require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/stripe_client.php';

apbRequireMethod('POST');
$body = apbJsonBody();
$kind = (string) ($body['kind'] ?? '');

function apbResolveBookingClient(array $body): array
{
    $jwt = apbVerifyJwt();
    if ($jwt && !empty($jwt['sub'])) {
        $rows = apbSupabaseSelect('clients', '?auth_user_id=eq.' . urlencode($jwt['sub']) . '&select=id,email,first_name,last_name,phone');
        if (!empty($rows)) {
            return $rows[0];
        }
    }
    $guest = $body['guest'] ?? [];
    $email = strtolower(trim((string) ($guest['email'] ?? '')));
    if (!$email || !str_contains($email, '@')) {
        apbJsonError(400, 'invalid_request', 'A valid email is required.');
    }
    return apbFindOrCreateClientByEmail(
        $email,
        (string) ($guest['firstName'] ?? ''),
        (string) ($guest['lastName'] ?? ''),
        (string) ($guest['phone'] ?? '')
    );
}

$bookingErrorMessages = [
    'SLOT_NOT_FOUND' => "Ce cours n'existe pas ou n'est plus disponible.",
    'SLOT_CANCELLED' => 'Ce créneau a été annulé.',
    'SLOT_FULL' => 'Ce cours est complet.',
];

if ($kind === 'booking') {
    $cartItems = $body['cartItems'] ?? [];
    if (!is_array($cartItems) || empty($cartItems)) {
        apbJsonError(400, 'invalid_request', 'cartItems is required.');
    }

    $client = apbResolveBookingClient($body);
    $bookings = [];
    $totalCents = 0;

    foreach ($cartItems as $item) {
        $slotId = isset($item['slotId']) ? (int) $item['slotId'] : 0;
        $courseDate = (string) ($item['courseDate'] ?? '');
        if (!$slotId || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $courseDate)) {
            apbJsonError(400, 'invalid_request', 'Each cart item needs a valid slotId and courseDate.');
        }

        // Price and capacity come from the DB, never the request body. Only
        // "duo" slots (capacity 2) allow more than 1 participant per
        // booking -- clamp server-side rather than trusting the cart item,
        // since this directly drives both the charge amount and how much
        // capacity api_book_slot() consumes (supabase/migrations/0004_participants_capacity.sql).
        $slotRows = apbSupabaseSelect('slots', '?id=eq.' . $slotId . '&select=price_cents,type');
        if (empty($slotRows)) {
            apbJsonError(422, 'SLOT_NOT_FOUND', $bookingErrorMessages['SLOT_NOT_FOUND']);
        }
        $maxParticipants = $slotRows[0]['type'] === 'duo' ? 2 : 1;
        $participants = isset($item['participants']) ? (int) $item['participants'] : 1;
        $participants = max(1, min($maxParticipants, $participants));
        $priceCents = (int) $slotRows[0]['price_cents'] * $participants;

        try {
            $booking = apbSupabaseRpc('api_book_slot', [
                'p_client_id' => $client['id'],
                'p_slot_id' => $slotId,
                'p_course_date' => $courseDate,
                'p_payment_type' => 'stripe',
                'p_carnet_id' => null,
                'p_total_paid_cents' => $priceCents,
                'p_payment_status' => 'awaiting_payment',
                'p_client_message' => isset($item['message']) ? (string) $item['message'] : null,
                'p_participants' => $participants,
            ]);
        } catch (RuntimeException $e) {
            $code = $e->getMessage();
            // Release any holds already created earlier in this same cart before failing.
            foreach ($bookings as $b) {
                try { apbSupabaseRpc('api_cancel_booking', ['p_booking_id' => $b['id'], 'p_actor_client_id' => null, 'p_is_admin' => true]); } catch (Throwable $ignored) {}
            }
            apbJsonError(422, $code, $bookingErrorMessages[$code] ?? 'Impossible de réserver ce cours pour le moment.');
        }

        $bookings[] = $booking;
        $totalCents += $priceCents;
    }

    $bookingIds = array_map(fn($b) => $b['id'], $bookings);

    // Restricted to 'card' -- the frontend mounts a classic Stripe Elements
    // Card Element and calls confirmCardPayment(), not the newer unified
    // Payment Element flow. Leaving the account's default
    // automatic_payment_methods enabled would include redirect-based methods
    // (Klarna, iDEAL, etc.) that require a return_url this integration
    // doesn't have, and confirmCardPayment() can't drive anyway.
    $pi = apbStripeClient()->paymentIntents->create([
        'amount' => $totalCents,
        'currency' => 'eur',
        'payment_method_types' => ['card'],
        'metadata' => ['kind' => 'booking', 'booking_ids' => implode(',', $bookingIds)],
    ]);

    // payment_intents row must exist before bookings can reference it (FK).
    apbSupabaseInsert('payment_intents', [
        'id' => $pi->id, 'kind' => 'booking', 'amount_cents' => $totalCents,
        'status' => $pi->status, 'client_id' => $client['id'],
        'metadata' => ['booking_ids' => $bookingIds],
    ]);
    foreach ($bookingIds as $id) {
        apbSupabaseUpdate('bookings', '?id=eq.' . urlencode($id), ['payment_intent_id' => $pi->id]);
    }

    // Full snapshot rows (not just ids) so the frontend can render the
    // confirmation screen straight from this response -- a guest checkout has
    // no session to re-fetch them with via my-bookings.php afterwards.
    apbJsonSuccess(['clientSecret' => $pi->client_secret, 'paymentIntentId' => $pi->id, 'bookingIds' => $bookingIds, 'bookings' => $bookings]);
}

if ($kind === 'carnet') {
    $client = apbRequireClient();
    $tarifId = isset($body['tarifId']) ? (int) $body['tarifId'] : 0;
    if (!$tarifId) {
        apbJsonError(400, 'invalid_request', 'tarifId is required.');
    }

    $tarifRows = apbSupabaseSelect('tarifs', '?id=eq.' . $tarifId . '&select=*');
    if (empty($tarifRows) || !$tarifRows[0]['is_carnet']) {
        apbJsonError(404, 'TARIF_NOT_FOUND', 'Ce carnet n\'existe pas.');
    }
    $tarif = $tarifRows[0];

    $code = 'APB-' . strtoupper(bin2hex(random_bytes(2))) . '-' . strtoupper(bin2hex(random_bytes(2)));
    $expiresAt = (new DateTime())->modify('+' . (int) $tarif['validity_months'] . ' months')->format('Y-m-d');

    // remaining_sessions starts at 0 -- unusable until the webhook confirms payment.
    $carnet = apbSupabaseInsert('carnets', [
        'code' => $code,
        'client_id' => $client['id'],
        'tarif_id' => $tarif['id'],
        'tarif_name_snapshot' => $tarif['name'],
        'type' => $tarif['type'],
        'total_sessions' => $tarif['session_count'],
        'remaining_sessions' => 0,
        'validity_months' => $tarif['validity_months'],
        'expires_at' => $expiresAt,
        'total_paid_cents' => $tarif['price_cents'],
        'status' => 'pending_payment',
        'active' => false,
    ]);

    $pi = apbStripeClient()->paymentIntents->create([
        'amount' => (int) $tarif['price_cents'],
        'currency' => 'eur',
        'payment_method_types' => ['card'],
        'metadata' => ['kind' => 'carnet', 'carnet_id' => $carnet['id']],
    ]);

    // payment_intents row must exist before the carnet can reference it (FK).
    apbSupabaseInsert('payment_intents', [
        'id' => $pi->id, 'kind' => 'carnet', 'amount_cents' => (int) $tarif['price_cents'],
        'status' => $pi->status, 'client_id' => $client['id'],
        'metadata' => ['carnet_id' => $carnet['id']],
    ]);
    apbSupabaseUpdate('carnets', '?id=eq.' . urlencode($carnet['id']), ['payment_intent_id' => $pi->id]);

    // Full snapshot (not just id/code) so the frontend can render the
    // confirmation screen straight from this response.
    apbJsonSuccess([
        'clientSecret' => $pi->client_secret, 'paymentIntentId' => $pi->id,
        'carnetId' => $carnet['id'], 'carnetCode' => $code,
        'carnet' => $carnet, 'client' => $client,
    ]);
}

apbJsonError(400, 'invalid_request', 'kind must be "booking" or "carnet".');
