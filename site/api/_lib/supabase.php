<?php
/**
 * Thin cURL wrapper around Supabase's REST (PostgREST) and RPC endpoints.
 * No supabase-php package -- Supabase is just HTTPS, and a raw wrapper
 * keeps the vendor/ folder (FTP-deployed with every push) small.
 *
 * All calls here use the service_role key, which bypasses Row Level
 * Security -- this file is only ever included from server-side api/*.php
 * scripts, never shipped to the browser.
 */

require_once __DIR__ . '/config_loader.php';

function apbSupabaseRequest(string $method, string $path, ?array $body = null): array
{
    $cfg = apbConfig();
    $url = rtrim($cfg['SUPABASE_URL'], '/') . $path;

    $ch = curl_init($url);
    $headers = [
        'apikey: ' . $cfg['SUPABASE_SERVICE_ROLE_KEY'],
        'Authorization: Bearer ' . $cfg['SUPABASE_SERVICE_ROLE_KEY'],
        'Content-Type: application/json',
        'Prefer: return=representation',
    ];

    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }

    $raw = curl_exec($ch);
    if ($raw === false) {
        $err = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException('Supabase request failed: ' . $err);
    }
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $decoded = $raw !== '' ? json_decode($raw, true) : null;
    return ['status' => $status, 'body' => $decoded];
}

/** SELECT via PostgREST, e.g. apbSupabaseSelect('slots', '?active=eq.true&order=day_of_week.asc') */
function apbSupabaseSelect(string $table, string $query = ''): array
{
    $res = apbSupabaseRequest('GET', "/rest/v1/{$table}{$query}");
    if ($res['status'] >= 400) {
        throw new RuntimeException("Supabase select on {$table} failed with status {$res['status']}: " . json_encode($res['body']));
    }
    return $res['body'] ?? [];
}

function apbSupabaseInsert(string $table, array $row): array
{
    $res = apbSupabaseRequest('POST', "/rest/v1/{$table}", $row);
    if ($res['status'] >= 400) {
        throw new RuntimeException("Supabase insert into {$table} failed with status {$res['status']}: " . json_encode($res['body']));
    }
    return $res['body'][0] ?? [];
}

/** UPDATE via PostgREST, $query carries the filter e.g. '?id=eq.123' */
function apbSupabaseUpdate(string $table, string $query, array $patch): array
{
    $res = apbSupabaseRequest('PATCH', "/rest/v1/{$table}{$query}", $patch);
    if ($res['status'] >= 400) {
        throw new RuntimeException("Supabase update on {$table} failed with status {$res['status']}: " . json_encode($res['body']));
    }
    return $res['body'] ?? [];
}

/** DELETE via PostgREST, $query carries the filter e.g. '?id=eq.123' */
function apbSupabaseDelete(string $table, string $query): void
{
    $res = apbSupabaseRequest('DELETE', "/rest/v1/{$table}{$query}");
    if ($res['status'] >= 400) {
        throw new RuntimeException("Supabase delete on {$table} failed with status {$res['status']}: " . json_encode($res['body']));
    }
}

/** Calls a Postgres function exposed via PostgREST RPC, e.g. api_book_slot */
function apbSupabaseRpc(string $functionName, array $params): array
{
    $res = apbSupabaseRequest('POST', "/rest/v1/rpc/{$functionName}", $params);
    if ($res['status'] >= 400) {
        // Postgres RAISE EXCEPTION messages (e.g. SLOT_FULL, CARNET_DEPLETED) surface in $res['body']['message']
        throw new RuntimeException($res['body']['message'] ?? "Supabase RPC {$functionName} failed with status {$res['status']}");
    }
    return $res['body'] ?? [];
}
