<?php
/**
 * GET  /api/admin-bookings.php                -- list all bookings
 * POST /api/admin-bookings.php  { action:'cancel', bookingId }  -- admin-forced cancel
 * POST /api/admin-bookings.php  { action:'update', bookingId, slotId, courseDate }
 *                                              -- move a booking to another course/date
 *
 * Requires staff (site/api/_lib/auth.php's apbRequireAdmin(), checked against
 * the `staff` table server-side -- the real enforcement layer; the admin
 * panel's own client-side check is UX only).
 */

require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/mailer.php';

apbRequireAdmin();

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    // bookings has no client_email column (only client_id) -- embed the
    // related clients row via PostgREST's relationship syntax so the admin
    // UI has an email to show/search/link on without a second round-trip.
    $bookings = apbSupabaseSelect('bookings', '?select=*,clients(email)&order=course_date.desc&limit=500');
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
    // Read before cancelling: the teacher mail needs the payment_status the
    // booking had, and the RPC's own return is the already-cancelled row.
    $before = apbSupabaseSelect('bookings', '?id=eq.' . urlencode($bookingId) . '&select=*');
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
    if (!empty($before)) {
        apbNotifyBookingCancelled($before[0]);
    }
    apbJsonSuccess($booking);
}

if ($action === 'update') {
    $bookingId  = (string) ($body['bookingId'] ?? '');
    $slotId     = isset($body['slotId']) ? (int) $body['slotId'] : 0;
    $courseDate = (string) ($body['courseDate'] ?? '');
    if (!$bookingId || !$slotId || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $courseDate)) {
        apbJsonError(400, 'invalid_request', 'bookingId, slotId et courseDate (YYYY-MM-DD) sont requis.');
    }

    // Même garde qu'à l'inscription (admin-book.php) : la date doit tomber le
    // jour où le cours a lieu, sinon la réservation atterrit à l'horaire du
    // cours un jour où il ne tourne pas.
    $slotRows = apbSupabaseSelect('slots', '?id=eq.' . $slotId . '&select=day_of_week');
    if (empty($slotRows)) {
        apbJsonError(404, 'slot_not_found', "Ce cours n'existe pas.");
    }
    $slotDow = (int) ($slotRows[0]['day_of_week'] ?? -1);
    $dateDow = ((int) (new DateTime($courseDate))->format('N')) - 1;
    if ($slotDow !== $dateDow) {
        $jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
        $attendu = $jours[$slotDow] ?? '?';
        apbJsonError(422, 'date_wrong_weekday', "La date choisie ne tombe pas un $attendu — ce cours a lieu le $attendu.");
    }

    $errorMessages = [
        'BOOKING_NOT_FOUND'  => 'Réservation introuvable.',
        'BOOKING_CANCELLED'  => "Cette réservation est annulée : elle ne peut plus être déplacée.",
        'SLOT_NOT_FOUND'     => "Ce cours n'existe pas ou n'est plus disponible.",
        'SLOT_CANCELLED'     => 'Ce créneau a été annulé.',
        'SLOT_FULL'          => 'Ce cours est complet à cette date.',
        'TEACHER_ABSENT'     => "Le professeur n'est pas disponible à cette date (absence/vacances).",
        'BOOKING_TOO_LATE'   => "Les réservations ferment 1h avant le début du cours.",
        'CARNET_WRONG_TYPE'  => "Cette séance vient d'un carnet d'une autre discipline que le cours choisi.",
    ];

    // La réservation telle qu'elle était : le mail de modification doit
    // pouvoir nommer l'ancien créneau, que la RPC écrase.
    $before = apbSupabaseSelect('bookings', '?id=eq.' . urlencode($bookingId) . '&select=*');
    try {
        // p_allow_past : comme admin-book.php, l'admin doit pouvoir corriger
        // une séance déjà passée. L'endpoint est derrière apbRequireAdmin().
        $booking = apbSupabaseRpc('api_move_booking', [
            'p_booking_id'  => $bookingId,
            'p_slot_id'     => $slotId,
            'p_course_date' => $courseDate,
            'p_allow_past'  => true,
        ]);
    } catch (RuntimeException $e) {
        $code = $e->getMessage();
        apbJsonError(422, $code, $errorMessages[$code] ?? 'Impossible de déplacer cette réservation.');
    }

    if (!empty($before)) {
        apbNotifyBookingMoved($before[0], $booking);
    }
    apbJsonSuccess($booking);
}

apbJsonError(400, 'unknown_action', 'Unknown action.');
