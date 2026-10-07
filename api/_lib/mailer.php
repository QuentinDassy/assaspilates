<?php
/**
 * Teacher and studio notifications sent through Resend (https://resend.com),
 * over its plain HTTPS API -- no SDK, same reasoning as supabase.php.
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

/**
 * The studio's own notification address (MAIL_ADMIN in config.php), copied on
 * every booking and cancellation whoever teaches the course -- otherwise the
 * studio only ever hears about the courses it teaches itself, and nothing at
 * all about a teacher whose team_members row has no email. It lives in
 * config.php rather than in that table because team_members.email is read
 * straight from the browser with the anon key (site/js/data.js), so anything
 * put there is public.
 */
function apbAdminMailAddress(): string
{
    return trim((string) (apbConfig()['MAIL_ADMIN'] ?? ''));
}

/**
 * One notification body. $teacherName greets the teacher when the mail is
 * theirs; null builds the studio copy, which names the teacher under the
 * course instead of greeting them.
 */
function apbNotifyBody(array $booking, string $lead, string $attendees, ?string $teacherName): string
{
    $body = $teacherName !== null ? '<p>Bonjour ' . apbEsc($teacherName) . ',</p>' : '';
    $body .= '<p><strong>' . apbEsc(apbClientName($booking)) . '</strong> ' . $lead . '</p>'
        . apbCourseLine($booking);
    if ($teacherName === null) {
        $body .= '<p style="margin:0 0 16px">Professeur : ' . apbEsc($booking['slot_teacher_snapshot']) . '</p>';
    }
    return $body . $attendees;
}

/**
 * Mails the teacher (when they have an address) and the studio. The studio
 * copy is skipped when MAIL_ADMIN is the teacher's own address, so whoever
 * teaches their own course gets one mail and not two.
 */
function apbSendNotification(array $booking, string $title, string $subject, string $lead): void
{
    $teacher = apbTeacherForBooking($booking);
    $admin = apbAdminMailAddress();
    if (!$teacher && $admin === '') {
        return;
    }
    $attendees = apbAttendeeList(apbOccurrenceAttendees($booking['slot_occurrence_id']));
    if ($teacher) {
        apbSendMail($teacher['email'], $subject, apbMailLayout($title, apbNotifyBody($booking, $lead, $attendees, $teacher['name'])));
    }
    if ($admin !== '' && (!$teacher || strcasecmp($admin, $teacher['email']) !== 0)) {
        apbSendMail($admin, $subject, apbMailLayout($title, apbNotifyBody($booking, $lead, $attendees, null)));
    }
}

/** Mail the teacher and the studio that a student booked. $booking is a full bookings row. */
function apbNotifyTeacherBooking(array $booking): void
{
    try {
        if (apbCourseAlreadyStarted($booking)) {
            return;
        }
        $subject = 'Nouvelle réservation — ' . $booking['slot_title_snapshot'] . ', '
            . apbFrenchDate($booking['course_date']) . ' ' . apbShortTime($booking['slot_start_snapshot']);
        apbSendNotification($booking, 'Nouvelle réservation', $subject, 'vient de réserver :');
    } catch (Throwable $e) {
        error_log('apbNotifyTeacherBooking failed: ' . $e->getMessage());
    }
}

/** Mail the teacher and the studio that a booking was cancelled. $booking is the bookings row as it was before cancelling. */
function apbNotifyTeacherCancellation(array $booking): void
{
    try {
        // A hold that was never paid was never announced to anyone either.
        if (($booking['payment_status'] ?? '') !== 'paid') {
            return;
        }
        // Same reasoning as the booking mail: tidying up a past course in the
        // admin isn't news anyone needs.
        if (apbCourseAlreadyStarted($booking)) {
            return;
        }
        $subject = 'Annulation — ' . $booking['slot_title_snapshot'] . ', '
            . apbFrenchDate($booking['course_date']) . ' ' . apbShortTime($booking['slot_start_snapshot']);
        apbSendNotification($booking, 'Annulation', $subject, 'a annulé sa réservation :');
    } catch (Throwable $e) {
        error_log('apbNotifyTeacherCancellation failed: ' . $e->getMessage());
    }
}

function apbNotifyTeacherBookingById(string $bookingId): void
{
    try {
        $rows = apbSupabaseSelect('bookings', '?id=eq.' . urlencode($bookingId) . '&select=*');
        if (!empty($rows) && $rows[0]['status'] !== 'cancelled') {
            apbNotifyBookingCreated($rows[0]);
        }
    } catch (Throwable $e) {
        error_log('apbNotifyTeacherBookingById failed: ' . $e->getMessage());
    }
}

/**
 * Mail the teachers and the studio that a booking moved. $before is the row
 * as it stood, $after the one api_move_booking() returned. A move can change
 * teacher, so both the one losing the student and the one gaining her are
 * written to -- a single mail each, showing where the student went.
 */
function apbNotifyBookingMoved(array $before, array $after): void
{
    try {
        // A correction made entirely in the past is bookkeeping, not news --
        // same reasoning as the booking and cancellation mails.
        if (apbCourseAlreadyStarted($before) && apbCourseAlreadyStarted($after)) {
            return;
        }

        $label = '<p style="margin:0 0 4px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#aaa">';
        $body = '<p>La réservation de <strong>' . apbEsc(apbClientName($after)) . '</strong> a été déplacée :</p>'
            . $label . 'Avant</p>' . apbCourseLine($before)
            . $label . 'Après</p>' . apbCourseLine($after)
            . apbAttendeeList(apbOccurrenceAttendees($after['slot_occurrence_id']));

        $subject = 'Réservation déplacée — ' . apbClientName($after) . ', '
            . apbFrenchDate($after['course_date']) . ' ' . apbShortTime($after['slot_start_snapshot']);
        $html = apbMailLayout('Réservation déplacée', $body);

        // One mail per address: the same teacher on both sides, or a teacher
        // who is also MAIL_ADMIN, must not receive it twice.
        $sent = [];
        foreach ([apbTeacherForBooking($before), apbTeacherForBooking($after)] as $teacher) {
            if ($teacher) {
                $sent[strtolower($teacher['email'])] = $teacher['email'];
            }
        }
        $admin = apbAdminMailAddress();
        if ($admin !== '') {
            $sent[strtolower($admin)] = $admin;
        }
        foreach ($sent as $address) {
            apbSendMail($address, $subject, $html);
        }

        apbNotifyClientMoved($before, $after);

        // Arriver sur un semi-collectif qui n'attendait qu'une deuxième
        // inscrite le confirme : les élèves déjà là doivent l'apprendre.
        if (!empty($after['slot_occurrence_id'])) {
            apbNotifyOccurrenceConfirmed($after['slot_occurrence_id']);
        }
    } catch (Throwable $e) {
        error_log('apbNotifyBookingMoved failed: ' . $e->getMessage());
    }
}

/* ===================================================================
 * Mails aux élèves (gabarits éditables -- supabase/migrations/0013)
 * =================================================================== */

/** Les gabarits, chargés une fois par requête. */
function apbMailTemplate(string $key): ?array
{
    static $templates = null;
    if ($templates === null) {
        $templates = [];
        try {
            foreach (apbSupabaseSelect('mail_templates', '?select=key,subject,body_html,enabled') as $t) {
                $templates[$t['key']] = $t;
            }
        } catch (Throwable $e) {
            // Table absente (migration pas encore passée) ou Supabase muet :
            // on n'écrit pas à l'élève, et le reste de la requête continue.
            error_log('mail_templates unreadable: ' . $e->getMessage());
        }
    }
    $t = $templates[$key] ?? null;
    return ($t && !empty($t['enabled'])) ? $t : null;
}

/** Coordonnées du studio, pour {studio_email} / {studio_tel}. */
function apbStudioSettings(): array
{
    static $settings = null;
    if ($settings === null) {
        try {
            $rows = apbSupabaseSelect('site_settings', '?id=eq.1&select=email,phone');
            $settings = $rows[0] ?? [];
        } catch (Throwable $e) {
            $settings = [];
        }
    }
    return $settings;
}

/** Les variables offertes aux gabarits pour une réservation donnée. */
function apbMailVars(array $booking): array
{
    $studio = apbStudioSettings();
    return [
        'prenom' => $booking['client_first_name_snapshot'] ?? '',
        'nom' => $booking['client_last_name_snapshot'] ?? '',
        'cours' => $booking['slot_title_snapshot'] ?? '',
        'date' => apbFrenchDate($booking['course_date']),
        'heure_debut' => apbShortTime($booking['slot_start_snapshot']),
        'heure_fin' => apbShortTime($booking['slot_end_snapshot']),
        'lieu' => apbLocationName($booking['slot_location_snapshot'] ?? ''),
        'professeur' => $booking['slot_teacher_snapshot'] ?? '',
        'reference' => $booking['booking_ref'] ?? '',
        'studio_email' => $studio['email'] ?? '',
        'studio_tel' => $studio['phone'] ?? '',
    ];
}

/**
 * Remplit un gabarit. Les valeurs sont échappées dans le corps HTML (elles
 * viennent de champs saisis par le client : un prénom « <script> » ne doit
 * pas devenir du balisage) mais pas dans l'objet, qui est du texte brut --
 * un « Prévost & Cie » échappé s'y afficherait « Prévost &amp; Cie ».
 */
function apbRenderMailTemplate(string $key, array $vars): ?array
{
    $t = apbMailTemplate($key);
    if (!$t) {
        return null;
    }
    $needles = $plain = $escaped = [];
    foreach ($vars as $name => $value) {
        $needles[] = '{' . $name . '}';
        $plain[] = (string) $value;
        $escaped[] = apbEsc((string) $value);
    }
    return [
        'subject' => str_replace($needles, $plain, $t['subject']),
        'html' => str_replace($needles, $escaped, $t['body_html']),
    ];
}

/** Même habillage que les mails aux profs, sans le titre : le gabarit porte son propre texte. */
function apbClientMailLayout(string $body): string
{
    return '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#2b2b2b;max-width:560px">'
        . $body
        . '<p style="color:#999;font-size:12px;margin-top:32px">Assas Pilates Ballet</p>'
        . '</div>';
}

/** L'adresse de connexion de l'élève, que bookings ne porte pas (seulement client_id). */
function apbClientEmailForBooking(array $booking): string
{
    if (empty($booking['client_id'])) {
        return '';
    }
    $rows = apbSupabaseSelect('clients', '?id=eq.' . urlencode($booking['client_id']) . '&select=email&limit=1');
    return (string) ($rows[0]['email'] ?? '');
}

/** Envoie un gabarit à l'élève d'une réservation. Retourne false si rien n'est parti. */
function apbSendClientTemplate(array $booking, string $key, array $extraVars = []): bool
{
    $to = apbClientEmailForBooking($booking);
    if ($to === '') {
        return false;
    }
    $rendered = apbRenderMailTemplate($key, array_merge(apbMailVars($booking), $extraVars));
    if (!$rendered) {
        return false;
    }
    return apbSendMail($to, $rendered['subject'], apbClientMailLayout($rendered['html']));
}

/**
 * Accuse réception à l'élève : confirmé, ou en attente d'un 2e élève pour un
 * semi-collectif. Rien n'est envoyé pour un cours déjà commencé -- une
 * inscription rétroactive n'est pas une nouvelle à annoncer.
 */
function apbNotifyClientBooking(array $booking): void
{
    try {
        if (apbCourseAlreadyStarted($booking)) {
            return;
        }
        if (($booking['status'] ?? '') === 'pending') {
            apbSendClientTemplate($booking, 'booking_pending');
            return;
        }
        if (($booking['status'] ?? '') === 'confirmed') {
            apbSendClientTemplate($booking, 'booking_confirmed');
            // Confirmée et prévenue : le balayage « cours confirmé » ci-dessous
            // ne doit pas lui réécrire.
            apbMarkConfirmedNotified([$booking['id']]);
        }
    } catch (Throwable $e) {
        error_log('apbNotifyClientBooking failed: ' . $e->getMessage());
    }
}

function apbMarkConfirmedNotified(array $bookingIds): void
{
    foreach ($bookingIds as $id) {
        apbSupabaseUpdate('bookings', '?id=eq.' . urlencode($id), ['confirmed_notified_at' => gmdate('c')]);
    }
}

/**
 * Prévient les élèves qu'un semi-collectif vient d'être confirmé.
 *
 * Le passage pending -> confirmed se fait dans api_book_slot(), à l'intérieur
 * de sa transaction : le PHP ne voit pas qui a basculé. On s'appuie donc sur
 * confirmed_notified_at (0013) -- une réservation confirmée jamais notifiée
 * est exactement une réservation à prévenir. Marquer avant d'envoyer serait
 * plus sûr contre un doublon, mais perdrait le mail en cas d'échec ; on
 * marque après, l'envoi en double restant moins grave que le silence.
 */
function apbNotifyOccurrenceConfirmed(string $occurrenceId): void
{
    try {
        $rows = apbSupabaseSelect('bookings',
            '?slot_occurrence_id=eq.' . urlencode($occurrenceId)
            . '&status=eq.confirmed&payment_status=eq.paid&confirmed_notified_at=is.null&select=*');
        foreach ($rows as $b) {
            if (apbCourseAlreadyStarted($b)) {
                continue;
            }
            apbSendClientTemplate($b, 'booking_now_confirmed');
            apbMarkConfirmedNotified([$b['id']]);
        }
    } catch (Throwable $e) {
        error_log('apbNotifyOccurrenceConfirmed failed: ' . $e->getMessage());
    }
}

function apbNotifyClientCancellation(array $booking): void
{
    try {
        if (($booking['payment_status'] ?? '') !== 'paid' || apbCourseAlreadyStarted($booking)) {
            return;
        }
        apbSendClientTemplate($booking, 'booking_cancelled');
    } catch (Throwable $e) {
        error_log('apbNotifyClientCancellation failed: ' . $e->getMessage());
    }
}

function apbNotifyClientMoved(array $before, array $after): void
{
    try {
        if (apbCourseAlreadyStarted($before) && apbCourseAlreadyStarted($after)) {
            return;
        }
        apbSendClientTemplate($after, 'booking_moved', [
            'ancien_cours' => $before['slot_title_snapshot'] ?? '',
            'ancienne_date' => apbFrenchDate($before['course_date']),
            'ancienne_heure' => apbShortTime($before['slot_start_snapshot']) . '–' . apbShortTime($before['slot_end_snapshot']),
        ]);
    } catch (Throwable $e) {
        error_log('apbNotifyClientMoved failed: ' . $e->getMessage());
    }
}

/* ===================================================================
 * Les trois points d'entrée appelés par les endpoints
 * =================================================================== */

/**
 * Une réservation vient d'être enregistrée (carnet, Stripe payé, ou inscrite
 * par le studio) : professeur + studio, l'élève, et les élèves qu'elle vient
 * éventuellement de faire passer de « en attente » à « confirmé ».
 */
function apbNotifyBookingCreated(array $booking): void
{
    apbNotifyTeacherBooking($booking);
    apbNotifyClientBooking($booking);
    if (!empty($booking['slot_occurrence_id'])) {
        apbNotifyOccurrenceConfirmed($booking['slot_occurrence_id']);
    }
}

/** $booking est la ligne telle qu'elle était avant l'annulation. */
function apbNotifyBookingCancelled(array $booking): void
{
    apbNotifyTeacherCancellation($booking);
    apbNotifyClientCancellation($booking);
}
