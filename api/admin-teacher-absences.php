<?php
/**
 * GET  /api/admin-teacher-absences.php                        -- list all absences
 * POST /api/admin-teacher-absences.php  { action:'create'|'delete', ... }
 *
 * Requires staff. Public reads still go straight from the browser to
 * Supabase (RLS "public read" policy on teacher_absences, same as every
 * other content table) so the booking pages can pre-filter which dates to
 * offer -- the real enforcement is server-side in api_book_slot()
 * (supabase/migrations/0005_teacher_absences_and_capacity.sql). This API is
 * only the admin write side.
 */

require_once __DIR__ . '/_lib/auth.php';

apbRequireAdmin();

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $absences = apbSupabaseSelect('teacher_absences', '?order=start_date.desc');
    apbJsonSuccess(['absences' => $absences]);
}

apbRequireMethod('POST');
$body = apbJsonBody();
$action = (string) ($body['action'] ?? '');

if ($action === 'create') {
    $teamMemberId = isset($body['teamMemberId']) ? (int) $body['teamMemberId'] : 0;
    $startDate = (string) ($body['startDate'] ?? '');
    $endDate = (string) ($body['endDate'] ?? '');
    if (!$teamMemberId || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
        apbJsonError(400, 'invalid_request', 'teamMemberId, startDate and endDate (YYYY-MM-DD) are required.');
    }
    if ($endDate < $startDate) {
        apbJsonError(400, 'invalid_request', 'endDate must be on or after startDate.');
    }
    $created = apbSupabaseInsert('teacher_absences', [
        'team_member_id' => $teamMemberId,
        'start_date' => $startDate,
        'end_date' => $endDate,
        'reason' => (string) ($body['reason'] ?? ''),
    ]);
    apbJsonSuccess($created, 201);
}

if ($action === 'delete') {
    $id = (string) ($body['id'] ?? '');
    if (!$id) {
        apbJsonError(400, 'invalid_request', 'id is required.');
    }
    apbSupabaseDelete('teacher_absences', '?id=eq.' . urlencode($id));
    apbJsonSuccess(['deleted' => true]);
}

apbJsonError(400, 'unknown_action', 'Unknown action.');
