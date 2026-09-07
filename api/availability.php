<?php
/**
 * GET /api/availability.php
 *
 * Public, no auth (aggregate counts only, no personal data). Returns every
 * slot_occurrences row from today onward. A (slot_id, course_date) with no
 * row here simply means nobody has booked it yet -- full slots.capacity is
 * available; the frontend computes remaining spots as
 * slot.capacity - (occurrence?.confirmed_count + occurrence?.pending_count || 0).
 */

require_once __DIR__ . '/_lib/auth.php';

apbRequireMethod('GET');

$today = (new DateTime())->format('Y-m-d');
$occurrences = apbSupabaseSelect('slot_occurrences', '?course_date=gte.' . urlencode($today) . '&order=course_date.asc');

apbJsonSuccess(['occurrences' => $occurrences]);
