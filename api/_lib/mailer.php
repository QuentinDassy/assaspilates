<?php
/**
 * Teacher notifications sent through Resend (https://resend.com), over its
 * plain HTTPS API -- no SDK, same reasoning as supabase.php.
 *
 * Nothing here ever throws or blocks the caller's own work: a booking or a
 * cancellation that already happened in the database must not turn into an
 * error for the student because a mail couldn't go out. Failures land in
 * the PHP error log instead. Without RESEND_API_KEY in config.php every
 * send is a silent no-op, so the site keeps working before mail is set up.
 */

require_once __DIR__ . '/config_loader.php';
require_once __DIR__ . '/supabase.php';

function apbSendMail(string $to, string $subject, string $html): bool
{
    $cfg = apbConfig();
    if (empty($cfg['RESEND_API_KEY']) || empty($cfg['MAIL_FROM']) || $to === '') {
        return false;
    }

    $payload = ['from' => $cfg['MAIL_FROM'], 'to' => [$to], 'subject' => $subject, 'html' => $html];
    if (!empty($cfg['MAIL_REPLY_TO'])) {
        $payload['reply_to'] = $cfg['MAIL_REPLY_TO'];
    }

    $ch = curl_init('https://api.resend.com/emails');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $cfg['RESEND_API_KEY'], 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
    ]);
    $raw = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($raw === false || $status >= 400) {
        error_log("Resend send to {$to} failed (HTTP {$status}): " . ($raw === false ? $err : $raw));
        return false;
    }
    return true;
}

function apbEsc(?string $s): string
{
    return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
}

/** "mardi 16 septembre" -- IntlDateFormatter isn't guaranteed on shared hosting, so no ext-intl. */
function apbFrenchDate(string $ymd): string
{
    $jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    $mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    $d = new DateTime($ymd);
    return $jours[(int) $d->format('N') - 1] . ' ' . (int) $d->format('j') . ' ' . $mois[(int) $d->format('n') - 1];
}

function apbShortTime(string $time): string
{
    return substr($time, 0, 5);
}

/**
 * The teacher of a booking: through slots.teacher_id when the slot still
 * exists, else by the name snapshot (slot deleted since, slot_id set null).
 * Returns null when there's nobody with an email to write to.
 */
function apbTeacherForBooking(array $booking): ?array
{
    $teacher = null;
    if (!empty($booking['slot_id'])) {
        $slots = apbSupabaseSelect('slots', '?id=eq.' . (int) $booking['slot_id'] . '&select=team_members(id,name,email)');
        $teacher = $slots[0]['team_members'] ?? null;
    }
    if (!$teacher && !empty($booking['slot_teacher_snapshot'])) {
        $rows = apbSupabaseSelect('team_members', '?name=eq.' . urlencode($booking['slot_teacher_snapshot']) . '&select=id,name,email&limit=1');
        $teacher = $rows[0] ?? null;
    }
    return ($teacher && !empty($teacher['email'])) ? $teacher : null;
}

function apbLocationName(string $key): string
{
    static $names = null;
    if ($names === null) {
        $names = [];
        foreach (apbSupabaseSelect('locations', '?select=key,name') as $loc) {
            $names[$loc['key']] = $loc['name'];
        }
    }
    return $names[$key] ?? $key;
}

function apbClientName(array $booking): string
{
    return trim(($booking['client_first_name_snapshot'] ?? '') . ' ' . ($booking['client_last_name_snapshot'] ?? ''));
}

/** Everyone currently booked on the same occurrence, for the "inscrits" block of each mail. */
function apbOccurrenceAttendees(string $occurrenceId): array
{
    return apbSupabaseSelect('bookings',
        '?slot_occurrence_id=eq.' . urlencode($occurrenceId)
        . '&status=neq.cancelled&payment_status=eq.paid'
        . '&select=client_first_name_snapshot,client_last_name_snapshot,client_phone_snapshot,participants,status,client_message'
        . '&order=created_at.asc');
}

function apbMailLayout(string $title, string $body): string
{
    return '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#2b2b2b;max-width:560px">'
        . '<h2 style="font-weight:normal;font-size:20px;margin:0 0 16px">' . apbEsc($title) . '</h2>'
        . $body
        . '<p style="color:#999;font-size:12px;margin-top:32px">Assas Pilates Ballet — notification automatique</p>'
        . '</div>';
}

function apbCourseLine(array $b): string
{
    return '<p style="margin:0 0 16px"><strong>' . apbEsc($b['slot_title_snapshot']) . '</strong><br>'
        . ucfirst(apbFrenchDate($b['course_date'])) . ', ' . apbShortTime($b['slot_start_snapshot']) . '–' . apbShortTime($b['slot_end_snapshot'])
        . '<br>' . apbEsc(apbLocationName($b['slot_location_snapshot'])) . '</p>';
}

function apbAttendeeList(array $attendees): string
{
    if (empty($attendees)) {
        return '<p style="margin:0">Plus aucun inscrit pour ce cours.</p>';
    }
    $total = array_sum(array_map(fn($a) => (int) $a['participants'], $attendees));
    $items = '';
    foreach ($attendees as $a) {
        $line = apbEsc(apbClientName($a));
        if ((int) $a['participants'] > 1) {
            $line .= ' (' . (int) $a['participants'] . ' pers.)';
        }
        if (!empty($a['client_phone_snapshot'])) {
            $line .= ' — ' . apbEsc($a['client_phone_snapshot']);
        }
        if ($a['status'] === 'pending') {
            $line .= ' <em style="color:#b07a00">en attente d\'un 2e élève</em>';
        }
        if (!empty($a['client_message'])) {
            $line .= '<br><span style="color:#666">« ' . apbEsc($a['client_message']) . ' »</span>';
        }
        $items .= '<li style="margin-bottom:6px">' . $line . '</li>';
    }
    return '<p style="margin:0 0 4px">Inscrits (' . $total . ') :</p><ul style="margin:0;padding-left:20px">' . $items . '</ul>';
}

/**
 * True once the course has started. Guards the booking mail: since
 * supabase/migrations/0011_retroactive_booking.sql an admin can record a
 * session that already happened, and announcing "Nouvelle réservation" for
 * last Tuesday's course would only confuse the teacher.
 */
function apbCourseAlreadyStarted(array $booking): bool
{
    try {
        $start = new DateTime($booking['course_date'] . ' ' . $booking['slot_start_snapshot'], new DateTimeZone('Europe/Paris'));
        return $start <= new DateTime('now', new DateTimeZone('Europe/Paris'));
    } catch (Throwable $e) {
        return false; // Unparseable date: mail rather than stay silent.
    }
}

/** Mail the teacher that a student booked. $booking is a full bookings row. */
function apbNotifyTeacherBooking(array $booking): void
{
    try {
        if (apbCourseAlreadyStarted($booking)) {
            return;
        }
        $teacher = apbTeacherForBooking($booking);
        if (!$teacher) {
            return;
        }
        $body = '<p>Bonjour ' . apbEsc($teacher['name']) . ',</p>'
            . '<p><strong>' . apbEsc(apbClientName($booking)) . '</strong> vient de réserver :</p>'
            . apbCourseLine($booking)
            . apbAttendeeList(apbOccurrenceAttendees($booking['slot_occurrence_id']));
        $subject = 'Nouvelle réservation — ' . $booking['slot_title_snapshot'] . ', '
            . apbFrenchDate($booking['course_date']) . ' ' . apbShortTime($booking['slot_start_snapshot']);
        apbSendMail($teacher['email'], $subject, apbMailLayout('Nouvelle réservation', $body));
    } catch (Throwable $e) {
        error_log('apbNotifyTeacherBooking failed: ' . $e->getMessage());
    }
}

/** Mail the teacher that a booking was cancelled. $booking is the bookings row as it was before cancelling. */
function apbNotifyTeacherCancellation(array $booking): void
{
    try {
        // A hold that was never paid was never announced to the teacher either.
        if (($booking['payment_status'] ?? '') !== 'paid') {
            return;
        }
        // Same reasoning as the booking mail: tidying up a past course in the
        // admin isn't news the teacher needs.
        if (apbCourseAlreadyStarted($booking)) {
            return;
        }
        $teacher = apbTeacherForBooking($booking);
        if (!$teacher) {
            return;
        }
        $body = '<p>Bonjour ' . apbEsc($teacher['name']) . ',</p>'
            . '<p><strong>' . apbEsc(apbClientName($booking)) . '</strong> a annulé sa réservation :</p>'
            . apbCourseLine($booking)
            . apbAttendeeList(apbOccurrenceAttendees($booking['slot_occurrence_id']));
        $subject = 'Annulation — ' . $booking['slot_title_snapshot'] . ', '
            . apbFrenchDate($booking['course_date']) . ' ' . apbShortTime($booking['slot_start_snapshot']);
        apbSendMail($teacher['email'], $subject, apbMailLayout('Annulation', $body));
    } catch (Throwable $e) {
        error_log('apbNotifyTeacherCancellation failed: ' . $e->getMessage());
    }
}

function apbNotifyTeacherBookingById(string $bookingId): void
{
    try {
        $rows = apbSupabaseSelect('bookings', '?id=eq.' . urlencode($bookingId) . '&select=*');
        if (!empty($rows) && $rows[0]['status'] !== 'cancelled') {
            apbNotifyTeacherBooking($rows[0]);
        }
    } catch (Throwable $e) {
        error_log('apbNotifyTeacherBookingById failed: ' . $e->getMessage());
    }
}
