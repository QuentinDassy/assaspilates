<?php
/**
 * GET  /api/admin-bookings.php                -- list all bookings
 * POST /api/admin-bookings.php  { action:'cancel', bookingId }  -- admin-forced cancel
 *
 * Requires staff (site/api/_lib/auth.php's apbRequireAdmin(), checked against
 * the `staff` table server-side -- the real enforcement layer; the admin
 * panel's own client-side check is UX only).
 */

require_once __DIR__ . '/_lib/auth.php';

apbRequireAdmin();

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $bookings = apbSupabaseSelect('bookings', '?order=course_date.desc&limit=500');
    apbJsonSuccess(['bookings' => $bookings]);
}

apbRequireMethod('POST');
$body = apbJsonBody();
$action = (string) ($body['action'] ?? '');

if ($action === 'cancel') {
    $bookingId = (string) ($body['bookingId'] ?? '');
    if (!$bookingId) {
        apbJsonError(400, 'invalid_request', 'bookingId is required.');
    }
    $errorMessages = [
        'BOOKING_NOT_FOUND' => 'Réservation introuvable.',
        'ALREADY_CANCELLED' => 'Cette réservation est déjà annulée.',
    ];
    try {
        $booking = apbSupabaseRpc('api_cancel_booking', [
            'p_booking_id' => $bookingId,
            'p_actor_client_id' => null,
            'p_is_admin' => true,
        ]);
    } catch (RuntimeException $e) {
        $code = $e->getMessage();
        apbJsonError(422, $code, $errorMessages[$code] ?? "Impossible d'annuler cette réservation.");
    }
    apbJsonSuccess($booking);
}

apbJsonError(400, 'unknown_action', 'Unknown action.');
