<?php
/**
 * GET  /api/admin-tarifs.php                                   -- list all tarifs
 * POST /api/admin-tarifs.php  { action:'create'|'update'|'delete', ... }
 *
 * Requires staff. Same story as admin-team.php: the public site reads tarifs
 * straight from Supabase with the anon key (site/js/data.js), only writes
 * need this endpoint -- and until it existed the Tarifs tab wrote to
 * localStorage alone (saveTarifForm()), so every price change announced
 * "✓ Visible instantanément sur le site" and reached nothing but that one
 * browser.
 *
 * `type` is the discipline (collectif/prive/duo/munz/decouverte). It is what
 * decides which carnet may be spent on which course (api_book_slot checks
 * carnets.type against slots.type) and which unit price a slot gets, so it is
 * required here even though the form used to omit it -- a tarif without a
 * type is a tarif nothing can use.
 *
 * Deletion is soft (active = false): carnets.tarif_id references these rows,
 * so a sold carnet would lose the formula it was bought under. The public
 * site only ever reads active ones.
 */

require_once __DIR__ . '/_lib/auth.php';

apbRequireAdmin();

const APB_TARIF_TYPES = ['collectif', 'prive', 'duo', 'munz', 'decouverte'];

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $tarifs = apbSupabaseSelect('tarifs', '?active=eq.true&order=id.asc');
    apbJsonSuccess(['tarifs' => $tarifs]);
}

apbRequireMethod('POST');
$body = apbJsonBody();
$action = (string) ($body['action'] ?? '');

if ($action === 'create' || $action === 'update') {
    $name = trim((string) ($body['name'] ?? ''));
    $type = trim((string) ($body['type'] ?? ''));
    if ($name === '') {
        apbJsonError(400, 'invalid_request', 'Le nom de la formule est obligatoire.');
    }
    if (!in_array($type, APB_TARIF_TYPES, true)) {
        apbJsonError(400, 'invalid_type', 'Choisissez la discipline de la formule.');
    }

    $isCarnet = !empty($body['isCarnet']);
    // The DB's carnet_fields_required CHECK refuses a carnet without both, and
    // a 0 would sell a carnet with no session in it.
    $sessionCount   = isset($body['sessionCount']) ? (int) $body['sessionCount'] : 0;
    $validityMonths = isset($body['validityMonths']) ? (int) $body['validityMonths'] : 0;
    if ($isCarnet && ($sessionCount < 1 || $validityMonths < 1)) {
        apbJsonError(400, 'invalid_carnet', 'Un carnet demande un nombre de séances et une validité (en mois).');
    }

    $patch = [
        'type' => $type,
        'name' => $name,
        'label' => (string) ($body['label'] ?? ''),
        'sessions_display' => (string) ($body['sessions'] ?? ''),
        // Prices are typed in euros in the admin and stored in cents here, the
        // way every other amount in this schema is.
        'price_cents' => (int) round(((float) ($body['price'] ?? 0)) * 100),
        'note' => (string) ($body['note'] ?? ''),
        'featured' => !empty($body['featured']),
        'is_carnet' => $isCarnet,
        'session_count' => $isCarnet ? $sessionCount : null,
        'validity_months' => $isCarnet ? $validityMonths : null,
        'updated_at' => gmdate('c'),
    ];

    if ($action === 'create') {
        $created = apbSupabaseInsert('tarifs', $patch);
        apbJsonSuccess($created, 201);
    }

    $id = isset($body['id']) ? (int) $body['id'] : 0;
    if (!$id) {
        apbJsonError(400, 'invalid_request', 'id is required.');
    }
    $updated = apbSupabaseUpdate('tarifs', '?id=eq.' . $id, $patch);
    apbJsonSuccess($updated[0] ?? null);
}

if ($action === 'delete') {
    $id = isset($body['id']) ? (int) $body['id'] : 0;
    if (!$id) {
        apbJsonError(400, 'invalid_request', 'id is required.');
    }
    apbSupabaseUpdate('tarifs', '?id=eq.' . $id, ['active' => false, 'updated_at' => gmdate('c')]);
    apbJsonSuccess(['deleted' => true]);
}

apbJsonError(400, 'unknown_action', 'Unknown action.');
