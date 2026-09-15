<?php
/**
 * Run once a day in the evening via OVH's "Tâches planifiées" (e.g. 19:00).
 * Sends each teacher one mail listing tomorrow's courses and who is booked
 * on each. Teachers with no booked course tomorrow get nothing.
 *
 * The per-booking and per-cancellation mails (site/api/_lib/mailer.php)
 * keep teachers current after this goes out, until bookings close 1h
 * before each course.
 *
 * CLI only, same guard as release-payment-holds.php.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('CLI only.');
}

require_once __DIR__ . '/../api/_lib/auth.php';
require_once __DIR__ . '/../api/_lib/mailer.php';

$tomorrow = (new DateTime('tomorrow', new DateTimeZone('Europe/Paris')))->format('Y-m-d');

$bookings = apbSupabaseSelect('bookings',
    '?course_date=eq.' . $tomorrow . '&status=neq.cancelled&payment_status=eq.paid'
    . '&select=*&order=slot_start_snapshot.asc,created_at.asc');

// teacher id => ['teacher' => row, 'courses' => [occurrence id => bookings[]]]
$byTeacher = [];
foreach ($bookings as $b) {
    $teacher = apbTeacherForBooking($b);
    if (!$teacher) {
        echo "No teacher email for booking {$b['id']} ({$b['slot_teacher_snapshot']}), skipped\n";
        continue;
    }
    $byTeacher[$teacher['id']]['teacher'] = $teacher;
    $byTeacher[$teacher['id']]['courses'][$b['slot_occurrence_id']][] = $b;
}

$sent = 0;
foreach ($byTeacher as $entry) {
    $teacher = $entry['teacher'];
    $body = '<p>Bonjour ' . apbEsc($teacher['name']) . ',</p>'
        . '<p>Voici vos cours de demain :</p>';
    foreach ($entry['courses'] as $courseBookings) {
        $body .= '<div style="border-top:1px solid #e5e5e5;padding-top:16px;margin-top:16px">'
            . apbCourseLine($courseBookings[0])
            . apbAttendeeList($courseBookings)
            . '</div>';
    }
    $count = count($entry['courses']);
    $subject = 'Vos cours de demain, ' . apbFrenchDate($tomorrow) . ' (' . $count . ' cours)';
    if (apbSendMail($teacher['email'], $subject, apbMailLayout('Récap de demain', $body))) {
        $sent++;
        echo "Recap sent to {$teacher['email']} ({$count} course(s))\n";
    } else {
        echo "Recap to {$teacher['email']} FAILED\n";
    }
}

echo "Done: {$sent} recap(s) sent for {$tomorrow}.\n";
