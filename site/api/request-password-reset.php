<?php
/**
 * POST /api/request-password-reset.php
 * Body: { email: string, redirectTo: string }
 *
 * Public, no auth. Replaces the browser's direct call to Supabase's /recover,
 * which silently did nothing for a large share of the studio's students:
 * anyone who booked as a guest, or whose carnet was created by the studio,
 * has a `clients` row but no auth.users account -- /recover answers 200 for
 * an unknown address and sends nothing, while the page said "un lien vient
 * d'être envoyé". Those people could neither log in nor reset.
 *
 * Here, an address the studio already knows (clients row) but that has no
 * account gets one created on the spot (email pre-confirmed; the signup
 * trigger links it to that same clients row), then the usual recovery link
 * -- so "Mot de passe oublié" doubles as "choisir mon mot de passe". An
 * address the studio has never seen gets nothing, so this can't be used to
 * mint accounts for arbitrary emails.
 *
 * The link is generated with the admin API and mailed through Resend
 * (mailer.php), not Supabase's built-in mailer, which only delivers to the
 * project's own team addresses and a couple of mails an hour. Without Resend
 * configured it falls back to /recover, i.e. the old behaviour.
 *
 * The response is the same whatever happened to the address, so it can't be
 * used to probe who is a student here.
 */

require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/mailer.php';

apbRequireMethod('POST');
$body = apbJsonBody();

$email = strtolower(trim((string) ($body['email'] ?? '')));
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    apbJsonError(400, 'invalid_email', 'Adresse email invalide.');
}

// Only ever send people back to this same site -- the link carries a session.
$redirectTo = (string) ($body['redirectTo'] ?? '');
$host = $_SERVER['HTTP_HOST'] ?? '';
if (!$redirectTo || parse_url($redirectTo, PHP_URL_HOST) !== strtok($host, ':')) {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $redirectTo = "{$scheme}://{$host}/booking/manage.html";
}

$done = fn() => apbJsonSuccess(['ok' => true]);

// One mail per address per minute: this endpoint is public and each call
// lands in someone's inbox.
$throttleFile = sys_get_temp_dir() . '/apb_reset_' . sha1($email);
if (is_file($throttleFile) && time() - (int) @file_get_contents($throttleFile) < 60) {
    $done();
}
@file_put_contents($throttleFile, (string) time());

try {
    $link = apbGenerateRecoveryLink($email, $redirectTo);

    if ($link === null) {
        $clients = apbSupabaseSelect('clients', '?email=eq.' . urlencode($email) . '&select=id,auth_user_id');
        if (empty($clients) || !empty($clients[0]['auth_user_id'])) {
            $done();
        }
        $created = apbSupabaseRequest('POST', '/auth/v1/admin/users', ['email' => $email, 'email_confirm' => true]);
        if ($created['status'] >= 400) {
            error_log("Password reset: creating auth user for {$email} failed (HTTP {$created['status']}): " . json_encode($created['body']));
            $done();
        }
        $link = apbGenerateRecoveryLink($email, $redirectTo);
        if ($link === null) {
            $done();
        }
    }

    $html = apbMailLayout('Choisir votre mot de passe',
        '<p style="margin:0 0 16px">Bonjour,</p>'
        . '<p style="margin:0 0 16px">Pour accéder à votre espace Assas Pilates Ballet (réservations, carnets), choisissez votre mot de passe en cliquant sur le bouton ci-dessous.</p>'
        . '<p style="margin:0 0 24px"><a href="' . apbEsc($link) . '" style="display:inline-block;background:#373737;color:#fff;text-decoration:none;padding:12px 24px">Choisir mon mot de passe</a></p>'
        . '<p style="margin:0 0 16px;color:#777;font-size:13px">Ce lien est valable une heure et ne sert qu\'une fois. Si vous n\'êtes pas à l\'origine de cette demande, ignorez simplement ce message.</p>');

    if (!apbSendMail($email, 'Votre mot de passe — Assas Pilates Ballet', $html)) {
        // Resend not configured (or down): the account exists now, so
        // Supabase's own mailer is at least worth a try.
        apbSupabaseRequest('POST', '/auth/v1/recover?redirect_to=' . urlencode($redirectTo), ['email' => $email]);
    }
} catch (RuntimeException $e) {
    error_log('Password reset for ' . $email . ' failed: ' . $e->getMessage());
}

$done();

/** The recovery action link for an existing auth user, or null when there is no such user. */
function apbGenerateRecoveryLink(string $email, string $redirectTo): ?string
{
    $res = apbSupabaseRequest('POST', '/auth/v1/admin/generate_link', [
        'type' => 'recovery',
        'email' => $email,
        'redirect_to' => $redirectTo,
    ]);
    if ($res['status'] >= 400) {
        return null;
    }
    // Top-level on current GoTrue, under "properties" on older versions.
    return $res['body']['action_link'] ?? $res['body']['properties']['action_link'] ?? null;
}
