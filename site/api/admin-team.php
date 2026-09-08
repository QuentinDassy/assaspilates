<?php
/**
 * GET  /api/admin-team.php                                    -- list all team members
 * POST /api/admin-team.php  { action:'create'|'update'|'delete', ... }
 *
 * Requires staff. Public reads of team_members still go straight from the
 * browser to Supabase (RLS "public read" policy, site/js/data.js's
 * syncContentFromSupabase()) -- only writes need this API, since anon has no
 * write policy on the table. Before this endpoint existed, the admin Team
 * tab only ever wrote to localStorage (site/js/data.js's saveTeam()), so
 * edits silently didn't survive switching browsers/computers -- same bug
 * family as the Stripe publishable key (see site/api/public-config.php).
 */

require_once __DIR__ . '/_lib/auth.php';

apbRequireAdmin();

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $team = apbSupabaseSelect('team_members', '?order=sort_order.asc');
    apbJsonSuccess(['team' => $team]);
}

apbRequireMethod('POST');
$body = apbJsonBody();
$action = (string) ($body['action'] ?? '');

if ($action === 'create' || $action === 'update') {
    $name = trim((string) ($body['name'] ?? ''));
    if (!$name) {
        apbJsonError(400, 'invalid_request', 'name is required.');
    }
    $patch = [
        'name' => $name,
        'email' => (string) ($body['email'] ?? ''),
        'role' => (string) ($body['role'] ?? ''),
        'bio_html' => (string) ($body['bio'] ?? ''),
        'tags' => array_values(array_filter(array_map('trim', explode(',', (string) ($body['tags'] ?? ''))))),
        'sort_order' => isset($body['order']) ? (int) $body['order'] : 0,
    ];

    if ($action === 'create') {
        $created = apbSupabaseInsert('team_members', $patch);
        apbJsonSuccess($created, 201);
    }

    $id = isset($body['id']) ? (int) $body['id'] : 0;
    if (!$id) {
        apbJsonError(400, 'invalid_request', 'id is required.');
    }
    $updated = apbSupabaseUpdate('team_members', '?id=eq.' . $id, $patch);
    apbJsonSuccess($updated[0] ?? null);
}

if ($action === 'delete') {
    $id = isset($body['id']) ? (int) $body['id'] : 0;
    if (!$id) {
        apbJsonError(400, 'invalid_request', 'id is required.');
    }
    apbSupabaseDelete('team_members', '?id=eq.' . $id);
    apbJsonSuccess(['deleted' => true]);
}

apbJsonError(400, 'unknown_action', 'Unknown action.');
