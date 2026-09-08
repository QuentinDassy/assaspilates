/**
 * Real Supabase Auth (email + password) for the browser, plain fetch on the
 * GoTrue REST API -- same "no build step, no ES modules" approach as
 * supabaseClient.js. Replaces the old plaintext-password-in-localStorage
 * scheme (site/js/data.js's getPasswords/checkClientPassword/etc, removed).
 *
 * Session storage note: the access/refresh tokens live in localStorage like
 * the old apb_session did -- this is standard for a SPA-style client-side
 * app and is what the browser SDK itself does. What actually changed is that
 * the token is now a real, signed, expiring Supabase JWT that every server
 * request verifies (site/api/_lib/auth.php), not an unsigned {email} blob
 * nobody checks.
 */

const AUTH_URL = SUPABASE_URL + '/auth/v1';
const AUTH_SESSION_KEY = 'apb_auth_session';

function storeAuthSession(data) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    user: data.user,
  }));
}

function getAuthSession() {
  try { return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || 'null'); }
  catch (e) { return null; }
}

function clearAuthSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

async function supabaseSignUp(email, password) {
  const res = await fetch(`${AUTH_URL}/signup`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || data.error || 'Erreur lors de la création du compte.');
  if (data.access_token) {
    storeAuthSession(data);
    return data;
  }
  // This project's /signup never returns a session directly (it always comes
  // back with only a pending confirmation, regardless of the "Confirm email"
  // setting) -- but a same-credentials sign-in right after works immediately.
  // Without this, every brand-new signup would be left with no session and
  // every following apbApiFetch call (e.g. the carnet purchase itself) would
  // 401.
  return supabaseSignIn(email, password);
}

async function supabaseSignIn(email, password) {
  const res = await fetch(`${AUTH_URL}/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Email ou mot de passe incorrect.');
  storeAuthSession(data);
  return data;
}

async function supabaseSignOut() {
  const session = getAuthSession();
  clearAuthSession();
  if (session && session.access_token) {
    try {
      await fetch(`${AUTH_URL}/logout`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}` },
      });
    } catch (e) { /* best-effort server-side revoke */ }
  }
}

// Returns a valid session (refreshing the token if it's expired/near expiry), or null.
async function refreshAuthSessionIfNeeded() {
  const session = getAuthSession();
  if (!session) return null;
  if (session.expires_at > Date.now() + 30000) return session;

  try {
    const res = await fetch(`${AUTH_URL}/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    const data = await res.json();
    if (!res.ok) { clearAuthSession(); return null; }
    storeAuthSession(data);
    return getAuthSession();
  } catch (e) {
    return null;
  }
}

/**
 * Calls the PHP API (site/api/*.php) with the current session's bearer token
 * attached automatically. Same-origin relative path ("/api/...") -- only
 * works where the PHP API is actually deployed and reachable (OVH), not on
 * the Netlify copy of this site, which is why every call site wraps this in
 * a try/catch and degrades gracefully rather than breaking the page.
 */
async function apbApiFetch(path, options = {}) {
  const session = await refreshAuthSessionIfNeeded();
  const headers = Object.assign({}, options.headers || {});
  if (session && session.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(path, Object.assign({}, options, { headers }));
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error((data && data.message) || `Request failed (${res.status})`);
    err.code = data && data.error;
    err.status = res.status;
    throw err;
  }
  return data;
}

// Cached alongside isCurrentUserStaff()'s own check -- getStaffFlags() below
// reads this rather than making its own request, since both are only ever
// needed together right after login (checkAdminAuthAndInit()).
let cachedStaffRow = null;

// True only if there's a valid session AND that user's id is in the `staff` table.
// This is a client-side convenience check for showing/hiding the admin UI --
// the REAL enforcement is server-side (site/api/_lib/auth.php's apbRequireAdmin(),
// checked on every write once the PHP API is deployed and reachable).
async function isCurrentUserStaff() {
  const session = await refreshAuthSessionIfNeeded();
  if (!session || !session.user) { cachedStaffRow = null; return false; }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/staff?select=role,can_view_stripe_config&user_id=eq.${session.user.id}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) { cachedStaffRow = null; return false; }
    const rows = await res.json();
    cachedStaffRow = rows[0] || null;
    return rows.length > 0;
  } catch (e) {
    cachedStaffRow = null;
    return false;
  }
}

// Per-section visibility flags for the currently signed-in staff member (set
// by the isCurrentUserStaff() call above). Defaults to fully visible if
// nothing's cached yet (e.g. called before login finishes) rather than
// hiding pages on a false negative.
function getStaffFlags() {
  return cachedStaffRow || { role: 'admin', can_view_stripe_config: true };
}
