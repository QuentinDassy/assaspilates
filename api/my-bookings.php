<?php
/**
 * GET /api/my-bookings.php
 *
 * Requires a logged-in client. Returns their own bookings and carnets,
 * scoped by the client_id resolved from the verified JWT -- never by an
 * email/id taken from the request, closing the class of hole that let
 * manage.html?email=... show/manage anyone's data before real auth.
 */

require_once __DIR__ . '/_lib/auth.php';

apbRequireMethod('GET');
$client = apbRequireClient();

$bookings = apbSupabaseSelect('bookings',
    '?client_id=eq.' . urlencode($client['id']) . '&order=course_date.desc');

$carnets = apbSupabaseSelect('carnets',
    '?client_id=eq.' . urlencode($client['id']) . '&order=purchased_at.desc');

apbJsonSuccess(['bookings' => $bookings, 'carnets' => $carnets]);
