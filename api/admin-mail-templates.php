<?php
/**
 * GET  /api/admin-mail-templates.php                          -- list the templates
 * POST /api/admin-mail-templates.php  { action:'update', key, subject, bodyHtml, enabled }
 *
 * Requires staff. The texts of the mails sent to students
 * (supabase/migrations/0013_client_mail_templates.sql), so the studio can
 * reword them without a deploy.
 *
 * mail_templates has no RLS policy at all: unlike tarifs or team_members it
 * is never read from the browser with the anon key, only through here and the
 * mailer, both service-role.
 *
 * Rows are only ever updated, never created or deleted from here -- each key
 * is wired to a specific moment in the booking flow by the PHP that sends it,
 * so a key the code doesn't know would send nothing, and a missing one would
 * silence a mail with no way to get it back from the admin.
 */

require_once __DIR__ . '/_lib/auth.php';

apbRequireAdmin();

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $templates = apbSupabaseSelect('mail_templates', '?select=*&order=key.asc');
    apbJsonSuccess(['templates' => $templates]);
}

apbRequireMethod('POST');
$body = apbJsonBody();

if ((string) ($body['action'] ?? '') !== 'update') {
    apbJsonError(400, 'unknown_action', 'Unknown action.');
}

$key = trim((string) ($body['key'] ?? ''));
$subject = trim((string) ($body['subject'] ?? ''));
$bodyHtml = (string) ($body['bodyHtml'] ?? '');

if ($key === '') {
    apbJsonError(400, 'invalid_request', 'key is required.');
}
if ($subject === '' || trim($bodyHtml) === '') {
    apbJsonError(400, 'invalid_request', "L'objet et le contenu du message sont obligatoires.");
}

$existing = apbSupabaseSelect('mail_templates', '?key=eq.' . urlencode($key) . '&select=key&limit=1');
if (empty($existing)) {
    apbJsonError(404, 'template_not_found', 'Ce message n\'existe pas.');
}

$updated = apbSupabaseUpdate('mail_templates', '?key=eq.' . urlencode($key), [
    'subject' => $subject,
    'body_html' => $bodyHtml,
    'enabled' => !empty($body['enabled']),
    'updated_at' => gmdate('c'),
]);

apbJsonSuccess($updated[0] ?? null);
