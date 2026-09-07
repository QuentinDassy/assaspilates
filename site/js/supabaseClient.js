/**
 * Minimal Supabase REST (PostgREST) client for the browser.
 * Plain fetch() on purpose -- no @supabase/supabase-js import, so every
 * page keeps working as a classic <script src="..."> with no build step
 * and no ES module refactor. Only used for public, RLS-read-open content
 * (locations/slots/team_members/tarifs/site_settings) with the anon
 * ("publishable") key -- safe to expose in the browser by design.
 */

const SUPABASE_URL = 'https://sywrtnydavcyncibkkhq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Dr29q1PFa746jrK08E6FCg_RTf4gig5';

async function supabaseSelect(table, query = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase select on ${table} failed (${res.status})`);
  }
  return res.json();
}
