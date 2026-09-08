<?php
/**
 * GET  /api/admin-slots.php                                   -- list active slots
 * POST /api/admin-slots.php  { action:'create'|'update'|'delete', ... }
 *
 * Requires staff. Public reads still go straight from the browser to
 * Supabase (RLS "public read" policy, site/js/data.js's
 * syncContentFromSupabase()) -- only writes need this API. Before this
 * endpoint existed, the admin Schedule tab only ever wrote to localStorage
 * (site/js/data.js's saveSlots()), same bug family as the Stripe
 * publishable key (see site/api/public-config.php) -- and it's needed now
 * anyway so teacher_id is set correctly for the absence feature
 * (supabase/migrations/0005_teacher_absences_and_capacity.sql) to work.
 *
 * Capacity is always derived from `type` server-side, never taken from the
 * request -- "privé max 1 / duo max 2 / semi-collectif max 6" is a fixed
 * business rule, not a per-slot admin setting.
 */

require_once __DIR__ . '/_lib/auth.php';

apbRequireAdmin();

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $slots = apbSupabaseSelect('slots', '?active=eq.true&order=day_of_week.asc,start_time.asc');
    apbJsonSuccess(['slots' => $slots]);
}

apbRequireMethod('POST');
$body = apbJsonBody();
$action = (string) ($body['action'] ?? '');

// munz/decouverte keep the previous default of 8 (never reported as wrong,
// unlike collectif, which the site's own copy already promised was 6).
$capacityByType = ['prive' => 1, 'duo' => 2, 'collectif' => 6, 'munz' => 8, 'decouverte' => 8];

if ($action === 'create' || $action === 'update') {
    $title = trim((string) ($body['title'] ?? ''));
    $type = (string) ($body['type'] ?? '');
    if (!$title || !isset($capacityByType[$type])) {
        apbJsonError(400, 'invalid_request', 'title and a valid type are required.');
    }

    $teacherId = (isset($body['teacherId']) && $body['teacherId'] !== '') ? (int) $body['teacherId'] : null;
    $teacherName = (string) ($body['teacherName'] ?? '');
    if ($teacherId) {
        $tRows = apbSupabaseSelect('team_members', '?id=eq.' . $teacherId . '&select=name');
        if (!empty($tRows)) {
            $teacherName = $tRows[0]['name'];
        }
    }
    if (!$teacherName) {
        apbJsonError(400, 'invalid_request', 'A teacher is required.');
    }

    $patch = [
        'day_of_week' => isset($body['day']) ? (int) $body['day'] : 0,
        'start_time' => (string) ($body['start'] ?? ''),
        'end_time' => (string) ($body['end'] ?? ''),
        'title' => $title,
        'type' => $type,
        'teacher_id' => $teacherId,
        'teacher_name' => $teacherName,
        'location_key' => (string) ($body['location'] ?? 'assas'),
        'capacity' => $capacityByType[$type],
        'price_cents' => isset($body['priceCents']) ? (int) $body['priceCents'] : 0,
        'active' => true,
    ];

    if ($action === 'create') {
        $created = apbSupabaseInsert('slots', $patch);
        apbJsonSuccess($created, 201);
    }

    $id = isset($body['id']) ? (int) $body['id'] : 0;
    if (!$id) {
        apbJsonError(400, 'invalid_request', 'id is required.');
    }
    $updated = apbSupabaseUpdate('slots', '?id=eq.' . $id, $patch);
    apbJsonSuccess($updated[0] ?? null);
}

if ($action === 'delete') {
    $id = isset($body['id']) ? (int) $body['id'] : 0;
    if (!$id) {
        apbJsonError(400, 'invalid_request', 'id is required.');
    }
    // Soft-delete (active=false, filtered out of every "public read" query
    // and the GET above): slot_occurrences/bookings reference slots.id with
    // no cascading delete, so a slot that was ever booked can't be hard-deleted.
    apbSupabaseUpdate('slots', '?id=eq.' . $id, ['active' => false]);
    apbJsonSuccess(['deleted' => true]);
}

apbJsonError(400, 'unknown_action', 'Unknown action.');
