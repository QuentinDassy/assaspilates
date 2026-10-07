/**
 * Assas Pilates Ballet — Admin JS
 */

let selectedDay    = 0;
let calWeekOffset  = 0;

// Libellés des disciplines (tarifs.type / slots.type / carnets.type).
const APB_TYPE_LABELS = { collectif: 'Semi-collectif', prive: 'Cours privé', duo: 'Duo', munz: 'Munz Floor', decouverte: 'Découverte' };

// ---- Output-encoding helpers ----
// Client-submitted fields (name/email/phone from the public booking form) are rendered
// here via innerHTML. Without escaping, a booking made with e.g. firstName =
// "<img src=x onerror=...>" runs arbitrary JS in whoever's browser views the admin panel.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
// For embedding a value inside onclick="fn('VALUE')" -- a JS string literal nested inside
// an HTML attribute. Escapes backslash/quote for the JS layer, then HTML-encodes the
// result so the value can never break out of either the JS string or the "..." attribute
// (e.g. an email of  x');alert(1);//  would otherwise execute as script).
function escapeJsAttr(value) {
  const jsEscaped = String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, '\\n');
  return escapeHtml(jsEscaped);
}

// Helper: display name from carnet or booking (handles both naming conventions).
// Returns the RAW name -- callers that insert it into HTML must escapeHtml() it
// themselves (see e.g. renderCarnetsAdmin); callers using it for .value/grouping
// (filterClients, renderClientsAdmin) need the raw string, not HTML-encoded.
function getClientName(obj) {
  if (obj.clientName) return obj.clientName;
  return [obj.clientFirstName, obj.clientLastName].filter(Boolean).join(' ').trim() || '—';
}

// ===== SUPABASE SYNC (Phase 3: real bookings/carnets, all clients) =====
// Unlike syncMyBookingsFromApi() (data.js, merges per-email so a logged-in
// client's real data doesn't clobber other demo entries), the admin view
// legitimately replaces the whole local apb_bookings/apb_carnets arrays --
// admin should see ALL real data, not a merge with stale demo data.
function apbMapAdminCarnet(c) {
  const cl = c.clients || {};
  return {
    id: c.id, code: c.code, tarifId: c.tarif_id, tarifName: c.tarif_name_snapshot, type: c.type,
    totalSessions: c.total_sessions, remainingSessions: c.remaining_sessions, validityMonths: c.validity_months,
    expiresAt: c.expires_at, active: c.active, status: c.status,
    clientEmail: cl.email || '', clientFirstName: cl.first_name || '', clientLastName: cl.last_name || '', clientPhone: cl.phone || '',
    totalPaid: (c.total_paid_cents || 0) / 100, purchasedAt: c.purchased_at, createdAt: c.purchased_at,
  };
}

function apbMapAdminBooking(b) {
  const cl = b.clients || {};
  return {
    id: b.id, clientFirstName: b.client_first_name_snapshot, clientLastName: b.client_last_name_snapshot,
    clientEmail: cl.email || '', clientPhone: b.client_phone_snapshot || '', clientMessage: b.client_message || '',
    slotId: b.slot_id, slotTitle: b.slot_title_snapshot,
    slotStart: (b.slot_start_snapshot || '').slice(0, 5), slotEnd: (b.slot_end_snapshot || '').slice(0, 5),
    teacher: b.slot_teacher_snapshot, slotTeacher: b.slot_teacher_snapshot, slotLocation: b.slot_location_snapshot,
    courseDate: b.course_date, participants: b.participants, paymentType: b.payment_type,
    carnetId: b.carnet_id, carnetCode: null, totalPaid: (b.total_paid_cents || 0) / 100,
    status: b.status, createdAt: b.created_at, cancelledAt: b.cancelled_at,
  };
}

/**
 * "Admin access required" reads as a permissions bug, but it almost always
 * means the session was replaced: signing in as a client anywhere on this
 * domain (booking, manage, buy-carnet) overwrites the one auth session in
 * localStorage, so this panel keeps showing cached data while its API calls
 * go out as that client. Say so, and send them back to the admin login.
 */
function adminApiErrorMessage(e) {
  if (e && e.status === 403) {
    document.getElementById('admin-login-screen').style.display = 'flex';
    document.getElementById('admin-layout').style.display = 'none';
    return "Votre session n'est plus celle d'un administrateur — vous vous êtes connecté avec un compte client dans ce navigateur. Reconnectez-vous avec votre compte admin (testez le parcours client dans une fenêtre de navigation privée pour éviter ça).";
  }
  return `Erreur : ${e.message}`;
}

async function syncAdminDataFromApi() {
  try {
    const [bookingsResp, carnetsResp] = await Promise.all([
      apbApiFetch('/api/admin-bookings.php'),
      apbApiFetch('/api/admin-carnets.php'),
    ]);
    const mappedCarnets = carnetsResp.carnets.map(apbMapAdminCarnet);
    const mappedBookings = bookingsResp.bookings.map(b => {
      const mapped = apbMapAdminBooking(b);
      const carnet = mappedCarnets.find(c => c.id === mapped.carnetId);
      if (carnet) mapped.carnetCode = carnet.code;
      return mapped;
    });
    saveCarnets(mappedCarnets);
    saveBookings(mappedBookings);
    return true;
  } catch (e) {
    console.warn('syncAdminDataFromApi failed:', e);
    return false;
  }
}

// ===== NAVIGATION =====
function showPage(pageId) {
  // Blocks direct navigation (e.g. an old bookmark) to a page this staff
  // member's account has been restricted from -- the nav link itself is
  // already hidden in checkAdminAuthAndInit(), this is the second layer.
  if (pageId === 'booking-config' && getStaffFlags().can_view_stripe_config === false) {
    pageId = 'dashboard';
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');
  document.querySelectorAll('.nav-item[data-page="' + pageId + '"]').forEach(n => n.classList.add('active'));
  renderCurrentPage(pageId);
}

document.querySelectorAll('.nav-item[data-page]').forEach(item => {
  item.addEventListener('click', () => showPage(item.dataset.page));
});

function renderCurrentPage(pageId) {
  switch(pageId) {
    case 'dashboard':    renderDashboard();     break;
    case 'schedule':     renderScheduleAdmin(); break;
    case 'team':         renderTeamAdmin();     break;
    case 'tarifs':       renderTarifsAdmin();   break;
    case 'infos':        renderInfosAdmin();    break;
    case 'mails':        renderMailTemplatesAdmin(); break;
    case 'booking-config': renderBookingConfig(); break;
    case 'booking-list': renderBookingList();   break;
    case 'carnets':      renderCarnetsAdmin();  break;
    case 'clients':      renderClientsAdmin();  break;
    case 'planning':     renderPlanningAdmin(); break;
  }
}

// ===== ALERT =====
function showAlert(containerId, msg, type = 'success') {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
  setTimeout(() => el.innerHTML = '', 3500);
}

// ===== DASHBOARD =====
function renderDashboard() {
  const slots    = getSlots();
  const team     = getTeam();
  const tarifs   = getTarifs();
  const bookings = getBookings();
  const carnets  = getCarnets();

  const confirmed = bookings.filter(b => b.status === 'confirmed' || b.status === 'pending').length;
  const pendingCount = bookings.filter(b => b.status === 'pending').length;
  const activeCarnets = carnets.filter(c => c.active && c.remainingSessions > 0).length;

  document.getElementById('dashboard-stats').innerHTML = `
    <div class="stat-card"><div class="stat-num">${slots.length}</div><div class="stat-lbl">Créneaux / semaine</div></div>
    <div class="stat-card"><div class="stat-num">${confirmed}${pendingCount ? `<span style="font-size:14px;color:#d97706"> (${pendingCount} en attente)</span>` : ''}</div><div class="stat-lbl">Réservations actives</div></div>
    <div class="stat-card"><div class="stat-num">${activeCarnets}</div><div class="stat-lbl">Carnets actifs</div></div>
    <div class="stat-card dark"><div class="stat-num">${team.length}</div><div class="stat-lbl">Membres équipe</div></div>
  `;

  renderMiniSchedule('dash-schedule');

  const sortedTeam = [...team].sort((a, b) => (a.order || 0) - (b.order || 0));
  document.getElementById('dash-team').innerHTML = sortedTeam.map(m => {
    const initials = m.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    return `<div class="dash-list-item">
      <div class="dash-avatar">${initials}</div>
      <div class="dash-item-main">
        <div class="dash-item-name">${m.name}</div>
        <div class="dash-item-sub">${m.role.split('·')[0].trim()}</div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('dash-tarifs').innerHTML = getTarifs().map(t => `
    <div class="dash-list-item">
      <div class="dash-item-main">
        <div class="dash-item-name">${t.name}</div>
        <div class="dash-item-sub">${t.sessions}</div>
      </div>
      <div class="dash-item-right">${t.price}€</div>
    </div>
  `).join('');
}

function renderMiniSchedule(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const slots = getSlots();
  let html = '';
  DAYS_SHORT.forEach((d, di) => {
    const daySlots = slots.filter(s => s.day === di).sort((a, b) => a.start.localeCompare(b.start));
    html += `<div class="mini-col"><div class="mini-col-h">${d}</div>`;
    if (!daySlots.length) {
      html += `<div class="no-slot">—</div>`;
    } else {
      daySlots.slice(0, 4).forEach(s => {
        html += `<div class="mini-slot" onclick="showPage('schedule');editSlot(${s.id})">
          <div class="mini-time">${s.start}</div>
          <div>${s.title.replace('Cours ', '').split('–')[0].trim().substring(0, 18)}</div>
        </div>`;
      });
      if (daySlots.length > 4) html += `<div class="no-slot">+${daySlots.length - 4}</div>`;
    }
    html += `</div>`;
  });
  container.innerHTML = html;
}

// ===== SCHEDULE =====
function renderScheduleAdmin() {
  renderDayPills();
  renderTeacherSelect();
  renderSlotTemplates();
  renderSlotsTable();
}

function renderTeacherSelect() {
  const sel = document.getElementById('slot-teacher');
  if (!sel) return;
  const current = sel.value;
  const team = [...getTeam()].sort((a, b) => (a.order || 0) - (b.order || 0));
  sel.innerHTML = team.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  if (current) sel.value = current;
}

function renderDayPills() {
  const container = document.getElementById('slot-days');
  if (!container) return;
  container.innerHTML = DAYS_SHORT.map((d, i) =>
    `<button class="day-pill${i === selectedDay ? ' active' : ''}" onclick="selectDay(${i})">${d}</button>`
  ).join('');
}

function selectDay(i) {
  selectedDay = i;
  renderDayPills();
}

function renderSlotsTable() {
  const slots = getSlots();
  const sorted = [...slots].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  const badge = document.getElementById('slot-count');
  if (badge) badge.textContent = `${slots.length} créneaux`;

  document.getElementById('slots-tbody').innerHTML = sorted.map(s => {
    const loc = (LOCATIONS && LOCATIONS[s.location || 'assas']) ? LOCATIONS[s.location || 'assas'].short : (s.location || 'assas');
    return `<tr>
      <td>${DAYS_SHORT[s.day]}</td>
      <td style="white-space:nowrap;font-size:12px">${s.start}–${s.end}</td>
      <td style="max-width:180px;font-size:12px">${s.title}</td>
      <td><span class="badge badge-${s.type}">${s.type}</span></td>
      <td style="font-size:11px;color:#888">${loc}</td>
      <td style="font-size:12px">${s.teacher}</td>
      <td class="actions">
        <button class="btn btn-sm btn-outline" onclick="editSlot(${s.id})">Modifier</button>
        <button class="btn btn-sm btn-danger" onclick="deleteSlot(${s.id})">✕</button>
      </td>
    </tr>`;
  }).join('');
}

/**
 * The courses already on the schedule, picked from a list rather than
 * retyped. Choosing one carries its type across, and the type is what prices
 * the slot server-side (admin-slots.php reads that type's unit tarif) -- a
 * title typed from scratch is how a slot ended up published at 0€.
 *
 * The free-text intitulé stays available behind the last entry, otherwise
 * the studio could never add a course it doesn't already run.
 */
const SLOT_TEMPLATE_NEW = '__new__';

function renderSlotTemplates() {
  const sel = document.getElementById('slot-template');
  if (!sel) return;
  const seen = new Map();
  getSlots().forEach(s => {
    const key = `${s.title}|${s.type}`;
    if (!seen.has(key)) seen.set(key, s);
  });
  const tarifs = getTarifs();
  const unitPrice = type => {
    const t = tarifs.find(x => x.type === type && !x.isCarnet);
    return t ? `${t.price}€` : '—';
  };
  const options = [...seen.values()]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map(s => `<option value="${escapeHtml(s.title)}|${escapeHtml(s.type)}">${escapeHtml(s.title)} — ${unitPrice(s.type)}</option>`)
    .join('');
  sel.innerHTML = options + `<option value="${SLOT_TEMPLATE_NEW}">— Autre cours (saisir l'intitulé) —</option>`;
}

function applySlotTemplate(value) {
  const titleEl   = document.getElementById('slot-title');
  const titleWrap = document.getElementById('slot-title-group');
  if (value === SLOT_TEMPLATE_NEW) {
    titleWrap.style.display = 'block';
    titleEl.value = '';
    titleEl.focus();
    return;
  }
  titleWrap.style.display = 'none';
  const sep = value.lastIndexOf('|');
  titleEl.value = value.slice(0, sep);
  document.getElementById('slot-type').value = value.slice(sep + 1);
}

/** Points the picker at `title`, falling back to the free-text entry. */
function selectSlotTemplate(title, type) {
  const sel = document.getElementById('slot-template');
  if (!sel) return;
  const match = [...sel.options].find(o => o.value === `${title}|${type}`);
  sel.value = match ? match.value : SLOT_TEMPLATE_NEW;
  applySlotTemplate(sel.value);
  if (!match) document.getElementById('slot-title').value = title;
}

async function saveSlot() {
  const id = document.getElementById('slot-id').value;
  const teacherId = parseInt(document.getElementById('slot-teacher').value) || null;
  const teacherName = (getTeam().find(t => t.id === teacherId) || {}).name || '';
  const payload = {
    action:   id ? 'update' : 'create',
    day:      selectedDay,
    start:    document.getElementById('slot-start').value,
    end:      document.getElementById('slot-end').value,
    title:    document.getElementById('slot-title').value.trim(),
    type:     document.getElementById('slot-type').value,
    location: document.getElementById('slot-location').value,
    teacherId, teacherName,
  };
  if (!payload.title) { showAlert('schedule-alert', 'Veuillez renseigner le titre du cours.', 'error'); return; }
  if (!teacherId)     { showAlert('schedule-alert', 'Veuillez sélectionner un·e professeur·e.', 'error'); return; }
  if (id) payload.id = parseInt(id);

  try {
    await apbApiFetch('/api/admin-slots.php', { method: 'POST', body: JSON.stringify(payload) });
    await syncContentFromSupabase();
    resetSlotForm();
    renderSlotsTable();
    renderMiniSchedule('dash-schedule');
    showAlert('schedule-alert', '✓ Créneau enregistré. Visible instantanément sur le site.');
  } catch (e) {
    showAlert('schedule-alert', `Erreur : ${e.message}`, 'error');
  }
}

function editSlot(id) {
  const slot = getSlots().find(s => s.id === id);
  if (!slot) return;
  document.getElementById('slot-id').value      = slot.id;
  selectedDay = slot.day;
  document.getElementById('slot-start').value   = slot.start;
  document.getElementById('slot-end').value      = slot.end;
  document.getElementById('slot-type').value    = slot.type;
  renderSlotTemplates();
  selectSlotTemplate(slot.title, slot.type);
  document.getElementById('slot-location').value = slot.location || 'assas';
  renderTeacherSelect();
  if (slot.teacherId) document.getElementById('slot-teacher').value = slot.teacherId;
  document.getElementById('slot-form-title').textContent = 'Modifier le créneau';
  renderDayPills();
  document.getElementById('slot-start').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function deleteSlot(id) {
  if (!confirm('Supprimer ce créneau ?')) return;
  try {
    await apbApiFetch('/api/admin-slots.php', { method: 'POST', body: JSON.stringify({ action: 'delete', id }) });
    await syncContentFromSupabase();
    renderSlotsTable();
    showAlert('schedule-alert', 'Créneau supprimé.');
  } catch (e) {
    showAlert('schedule-alert', `Erreur : ${e.message}`, 'error');
  }
}

function resetSlotForm() {
  document.getElementById('slot-id').value      = '';
  document.getElementById('slot-start').value   = '09:00';
  document.getElementById('slot-end').value     = '09:55';
  document.getElementById('slot-title').value   = '';
  document.getElementById('slot-type').value    = 'collectif';
  renderSlotTemplates();
  const tpl = document.getElementById('slot-template');
  if (tpl && tpl.options.length) applySlotTemplate(tpl.options[0].value);
  document.getElementById('slot-location').value = 'assas';
  renderTeacherSelect();
  document.getElementById('slot-form-title').textContent = 'Nouveau créneau';
  selectedDay = 0;
  renderDayPills();
}

// ===== TEAM =====
function renderTeamAdmin() {
  const team = getTeam();
  const sorted = [...team].sort((a, b) => (a.order || 0) - (b.order || 0));
  document.getElementById('team-tbody').innerHTML = sorted.map(m => `
    <tr>
      <td><strong>${escapeHtml(m.name)}</strong></td>
      <td style="font-size:12px;color:#888">${escapeHtml(m.role)}</td>
      <td>${m.order + 1}</td>
      <td class="actions">
        <button class="btn btn-sm btn-outline" onclick="editMember(${m.id})">Modifier</button>
        <button class="btn btn-sm btn-outline" onclick="openAbsencesModal(${m.id})">Vacances</button>
        <button class="btn btn-sm btn-danger" onclick="deleteMember(${m.id})">✕</button>
      </td>
    </tr>
  `).join('');
}

async function saveMember() {
  const id = document.getElementById('member-id').value;
  const m = {
    name:  document.getElementById('member-name').value.trim(),
    email: document.getElementById('member-email').value.trim(),
    role:  document.getElementById('member-role').value.trim(),
    bio:   document.getElementById('member-bio').value.trim(),
    tags:  document.getElementById('member-tags').value.trim(),
    order: parseInt(document.getElementById('member-order').value) || 0,
  };
  if (!m.name) { showAlert('team-alert', 'Le nom est obligatoire.', 'error'); return; }
  try {
    await apbApiFetch('/api/admin-team.php', {
      method: 'POST',
      body: JSON.stringify(Object.assign({ action: id ? 'update' : 'create' }, m, id ? { id: parseInt(id) } : {})),
    });
    await syncContentFromSupabase();
    resetMemberForm();
    renderTeamAdmin();
    showAlert('team-alert', '✓ Membre enregistré. Visible instantanément sur le site.');
  } catch (e) {
    showAlert('team-alert', `Erreur : ${e.message}`, 'error');
  }
}

function editMember(id) {
  const m = getTeam().find(t => t.id === id);
  if (!m) return;
  document.getElementById('member-id').value     = m.id;
  document.getElementById('member-name').value   = m.name;
  document.getElementById('member-email').value  = m.email || '';
  document.getElementById('member-role').value   = m.role;
  document.getElementById('member-bio').value    = m.bio;
  document.getElementById('member-tags').value   = m.tags || '';
  document.getElementById('member-order').value  = m.order || 0;
  document.getElementById('team-form-title').textContent = 'Modifier ' + m.name;
}

async function deleteMember(id) {
  if (!confirm('Supprimer ce membre ?')) return;
  try {
    await apbApiFetch('/api/admin-team.php', { method: 'POST', body: JSON.stringify({ action: 'delete', id }) });
    await syncContentFromSupabase();
    renderTeamAdmin();
    showAlert('team-alert', 'Membre supprimé.');
  } catch (e) {
    showAlert('team-alert', `Erreur : ${e.message}`, 'error');
  }
}

function resetMemberForm() {
  ['member-id','member-name','member-email','member-role','member-bio','member-tags'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('member-order').value = '0';
  document.getElementById('team-form-title').textContent = 'Nouveau membre';
}

// ===== TEACHER ABSENCES ("Vacances") =====
// Pendant une période d'absence, aucune réservation n'est possible avec ce
// professeur -- appliqué côté serveur dans api_book_slot() (voir
// supabase/migrations/0005_teacher_absences_and_capacity.sql). Les lectures
// publiques passent directement par Supabase (comme team_members/slots) ;
// seule l'écriture passe par site/api/admin-teacher-absences.php.
function openAbsencesModal(teacherId) {
  const member = getTeam().find(t => t.id === teacherId);
  if (!member) return;
  renderAbsencesModal(teacherId);
}

function renderAbsencesModal(teacherId) {
  const member = getTeam().find(t => t.id === teacherId);
  if (!member) return;
  let modal = document.getElementById('absences-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'absences-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow-y:auto';
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  const absences = getTeacherAbsences().filter(a => a.teacherId === teacherId)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  const today = formatDateISO(new Date());

  modal.innerHTML = `
    <div style="background:#fff;max-width:480px;width:100%;position:relative;max-height:90vh;overflow-y:auto">
      <div style="background:#373737;color:#fff;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0">
        <div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300">Vacances — ${escapeHtml(member.name)}</div>
        <button onclick="document.getElementById('absences-modal').remove()" style="background:none;border:none;color:#fff;font-size:24px;cursor:pointer;line-height:1">×</button>
      </div>
      <div style="padding:24px">
        <p style="font-size:12px;color:#888;margin-bottom:16px">Aucune réservation ne sera possible avec ce professeur pendant les périodes ci-dessous.</p>
        <div id="absences-alert"></div>
        <div class="form-row">
          <div class="form-group"><label>Du</label><input type="date" id="absence-start" value="${today}" min="${today}" onchange="onAbsenceStartChange()"></div>
          <div class="form-group"><label>Au</label><input type="date" id="absence-end" value="${today}" min="${today}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>De (heure)</label><input type="time" id="absence-start-time"></div>
          <div class="form-group"><label>À (heure)</label><input type="time" id="absence-end-time"></div>
        </div>
        <p style="font-size:11px;color:#999;margin:-6px 0 12px">Heures optionnelles — laisser vide pour bloquer la journée entière.</p>
        <div class="form-group"><label>Motif (optionnel)</label><input type="text" id="absence-reason" placeholder="Congés, formation..."></div>
        <div class="form-actions" style="margin-bottom:20px">
          <button class="btn btn-primary" onclick="addAbsence(${teacherId})">Ajouter</button>
        </div>
        <table class="table">
          <thead><tr><th>Du</th><th>Au</th><th>Horaire</th><th>Motif</th><th></th></tr></thead>
          <tbody>
            ${absences.length ? absences.map(a => `
              <tr>
                <td style="font-size:12px">${frDate(a.startDate)}</td>
                <td style="font-size:12px">${frDate(a.endDate)}</td>
                <td style="font-size:12px">${a.startTime ? `${escapeHtml(a.startTime)}–${escapeHtml(a.endTime)}` : 'Journée entière'}</td>
                <td style="font-size:12px">${escapeHtml(a.reason || '—')}</td>
                <td class="actions"><button class="btn btn-sm btn-danger" onclick="deleteAbsence('${a.id}',${teacherId})">✕</button></td>
              </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:#bbb;padding:16px;font-style:italic">Aucune période enregistrée.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
  modal.style.display = 'flex';
}

// yyyy-mm-dd -> jj/mm/aaaa for display (the <input type=date> fields already
// render in the browser's own locale format natively -- this is only for the
// table listing below, which was showing the raw ISO string).
function frDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR');
}

// Keeps "Au" from ever being set before "Du" -- both the min attribute (so the
// date picker itself can't offer an earlier day) and, if "Au" was already set
// to something now-invalid, bumping it forward to match.
function onAbsenceStartChange() {
  const startEl = document.getElementById('absence-start');
  const endEl = document.getElementById('absence-end');
  endEl.min = startEl.value;
  if (endEl.value < startEl.value) endEl.value = startEl.value;
}

async function addAbsence(teacherId) {
  const startDate = document.getElementById('absence-start').value;
  const endDate   = document.getElementById('absence-end').value;
  const startTime = document.getElementById('absence-start-time').value;
  const endTime   = document.getElementById('absence-end-time').value;
  const reason    = document.getElementById('absence-reason').value.trim();
  const alertEl = document.getElementById('absences-alert');
  if (!startDate || !endDate) { alertEl.innerHTML = '<div class="alert alert-error">Dates de début et de fin requises.</div>'; return; }
  if (endDate < startDate)    { alertEl.innerHTML = '<div class="alert alert-error">La date de fin doit être après la date de début.</div>'; return; }
  if ((startTime && !endTime) || (!startTime && endTime)) { alertEl.innerHTML = '<div class="alert alert-error">Renseignez l\'heure de début ET de fin, ou laissez les deux vides.</div>'; return; }
  if (startTime && endTime && endTime <= startTime) { alertEl.innerHTML = '<div class="alert alert-error">L\'heure de fin doit être après l\'heure de début.</div>'; return; }
  try {
    await apbApiFetch('/api/admin-teacher-absences.php', {
      method: 'POST', body: JSON.stringify({ action: 'create', teamMemberId: teacherId, startDate, endDate, startTime, endTime, reason }),
    });
    await syncContentFromSupabase();
    renderAbsencesModal(teacherId);
  } catch (e) {
    alertEl.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
  }
}

async function deleteAbsence(id, teacherId) {
  try {
    await apbApiFetch('/api/admin-teacher-absences.php', { method: 'POST', body: JSON.stringify({ action: 'delete', id }) });
    await syncContentFromSupabase();
    renderAbsencesModal(teacherId);
  } catch (e) {
    document.getElementById('absences-alert').innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
  }
}

// ===== TARIFS =====

// Les formules passent par /api/admin-tarifs.php. Avant, saveTarifForm()
// n'écrivait que dans localStorage tout en annonçant « Visible instantanément
// sur le site » : le prix ne changeait que sur ce navigateur.
function renderTarifsAdmin() {
  const tarifs = getTarifs();
  document.getElementById('tarifs-tbody').innerHTML = tarifs.map(t => `
    <tr>
      <td>
        <strong>${escapeHtml(t.name)}</strong>${t.isCarnet ? ' <span style="font-size:10px;background:#e8f5e9;color:#2E6B30;padding:2px 6px">Carnet</span>' : ''}<br>
        <span style="font-size:11px;color:#999">${escapeHtml(t.label || '')}</span>
      </td>
      <td style="font-size:12px">${escapeHtml(APB_TYPE_LABELS[t.type] || t.type || '—')}<div style="font-size:11px;color:#999">${escapeHtml(t.sessions || '')}</div></td>
      <td style="font-weight:500;color:#93bdb0">${escapeHtml(String(t.price))}€</td>
      <td>${t.featured ? '<span class="badge badge-featured">✓ Oui</span>' : '—'}</td>
      <td class="actions">
        <button class="btn btn-sm btn-outline" onclick="editTarif(${t.id})">Modifier</button>
        <button class="btn btn-sm btn-danger" onclick="deleteTarif(${t.id})">✕</button>
      </td>
    </tr>
  `).join('');
}

async function saveTarifForm() {
  const id = document.getElementById('tarif-id').value;
  const isCarnet = document.getElementById('tarif-is-carnet').checked;
  const payload = {
    action: id ? 'update' : 'create',
    id: id ? parseInt(id) : undefined,
    // La discipline décide quel carnet sert à quel cours : sans elle, la
    // formule n'est utilisable nulle part (et la base la refuse).
    type:     document.getElementById('tarif-type').value,
    name:     document.getElementById('tarif-name').value.trim(),
    label:    document.getElementById('tarif-label').value.trim(),
    sessions: document.getElementById('tarif-sessions').value.trim(),
    price:    document.getElementById('tarif-price').value,
    note:     document.getElementById('tarif-note').value.trim(),
    featured: document.getElementById('tarif-featured').checked,
    isCarnet,
    sessionCount:   isCarnet ? (parseInt(document.getElementById('tarif-session-count').value) || 0) : 0,
    validityMonths: isCarnet ? (parseInt(document.getElementById('tarif-validity').value) || 0) : 0,
  };
  if (!payload.name) { showAlert('tarifs-alert', 'Le nom est obligatoire.', 'error'); return; }
  if (!payload.type) { showAlert('tarifs-alert', 'Choisissez la discipline de la formule.', 'error'); return; }

  try {
    await apbApiFetch('/api/admin-tarifs.php', { method: 'POST', body: JSON.stringify(payload) });
    await syncContentFromSupabase();
  } catch (e) {
    showAlert('tarifs-alert', adminApiErrorMessage(e), 'error');
    return;
  }
  resetTarifForm();
  renderTarifsAdmin();
  showAlert('tarifs-alert', '✓ Formule enregistrée. Visible sur le site.');
}

function editTarif(id) {
  const t = getTarifs().find(x => x.id === id);
  if (!t) return;
  document.getElementById('tarif-id').value            = t.id;
  document.getElementById('tarif-type').value          = t.type || '';
  document.getElementById('tarif-name').value          = t.name;
  document.getElementById('tarif-label').value         = t.label;
  document.getElementById('tarif-sessions').value      = t.sessions;
  document.getElementById('tarif-price').value         = t.price;
  document.getElementById('tarif-note').value          = t.note;
  document.getElementById('tarif-featured').checked    = t.featured;
  document.getElementById('tarif-is-carnet').checked   = t.isCarnet || false;
  document.getElementById('tarif-session-count').value = t.sessionCount || 0;
  document.getElementById('tarif-validity').value      = t.validityMonths || 0;
  document.getElementById('tarif-form-title').textContent = 'Modifier la formule';
  toggleCarnetFields();
}

// Suppression douce côté serveur (active = false) : les carnets déjà vendus
// référencent la formule sous laquelle ils ont été achetés.
async function deleteTarif(id) {
  if (!confirm('Retirer cette formule du site ?\nLes carnets déjà vendus sous cette formule ne sont pas affectés.')) return;
  try {
    await apbApiFetch('/api/admin-tarifs.php', { method: 'POST', body: JSON.stringify({ action: 'delete', id }) });
    await syncContentFromSupabase();
  } catch (e) {
    showAlert('tarifs-alert', adminApiErrorMessage(e), 'error');
    return;
  }
  renderTarifsAdmin();
  showAlert('tarifs-alert', 'Formule retirée.');
}

function resetTarifForm() {
  ['tarif-id','tarif-name','tarif-label','tarif-sessions','tarif-price','tarif-note','tarif-session-count','tarif-validity'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('tarif-type').value = '';
  document.getElementById('tarif-featured').checked  = false;
  document.getElementById('tarif-is-carnet').checked = false;
  document.getElementById('tarif-form-title').textContent = 'Nouvelle formule';
  toggleCarnetFields();
}

function toggleCarnetFields() {
  const isCarnet = document.getElementById('tarif-is-carnet').checked;
  const block = document.getElementById('carnet-fields-block');
  if (block) block.style.display = isCarnet ? 'block' : 'none';
}

// ===== INFOS =====
function renderInfosAdmin() {
  const infos = getInfos();
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('info-addr1',     infos.addr1);
  set('info-addr2',     infos.addr2);
  set('info-tel',       infos.tel);
  set('info-email',     infos.email);
  set('info-instagram', infos.instagram);
  set('info-cancel',    infos.cancelHours);
  set('info-retard',    infos.retardMin);
  set('info-ponct',     infos.ponctMsg);
}

// Passe par /api/admin-infos.php (la ligne unique site_settings). Avant,
// cette fonction n'écrivait que dans localStorage : « Visibles sur le site »
// ne valait que pour ce navigateur.
async function saveInfosForm() {
  const get = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  const payload = {
    addr1:       get('info-addr1'),
    addr2:       get('info-addr2'),
    tel:         get('info-tel'),
    email:       get('info-email'),
    instagram:   get('info-instagram'),
    cancelHours: parseInt(get('info-cancel')) || 24,
    retardMin:   parseInt(get('info-retard')) || 10,
    ponctMsg:    get('info-ponct'),
  };
  try {
    await apbApiFetch('/api/admin-infos.php', { method: 'POST', body: JSON.stringify(payload) });
    await syncContentFromSupabase();
  } catch (e) {
    showAlert('infos-alert', adminApiErrorMessage(e), 'error');
    return;
  }
  renderInfosAdmin();
  showAlert('infos-alert', '✓ Informations enregistrées. Visibles sur le site.');
}

// ===== MAILS AUX ÉLÈVES (gabarits éditables) =====
// Les textes vivent en base (supabase/migrations/0013_client_mail_templates.sql)
// et se modifient ici, sans déploiement. Ils ne passent pas par le cache
// localStorage des autres contenus : ils ne sont lisibles qu'en service_role,
// jamais avec la clé anon depuis le navigateur.
let apbMailTemplates = [];

// Variables communes à tous les messages ; booking_moved en a trois de plus,
// qui décrivent le créneau quitté.
const APB_MAIL_VARS = ['prenom', 'nom', 'cours', 'date', 'heure_debut', 'heure_fin', 'lieu', 'professeur', 'reference', 'studio_email', 'studio_tel'];
const APB_MAIL_VARS_EXTRA = { booking_moved: ['ancien_cours', 'ancienne_date', 'ancienne_heure'] };

async function renderMailTemplatesAdmin() {
  const host = document.getElementById('mails-content');
  if (!host) return;
  host.innerHTML = '<div style="color:#bbb;font-style:italic;padding:24px">Chargement…</div>';

  try {
    const resp = await apbApiFetch('/api/admin-mail-templates.php');
    apbMailTemplates = resp.templates || [];
  } catch (e) {
    // Table absente tant que la migration 0013 n'est pas passée : le dire
    // plutôt que d'afficher une page vide.
    host.innerHTML = `<div class="alert alert-error">${escapeHtml(adminApiErrorMessage(e))}</div>`;
    return;
  }

  if (!apbMailTemplates.length) {
    host.innerHTML = '<div style="color:#bbb;font-style:italic;padding:24px">Aucun message configuré.</div>';
    return;
  }

  host.innerHTML = apbMailTemplates.map(t => {
    const vars = APB_MAIL_VARS.concat(APB_MAIL_VARS_EXTRA[t.key] || []);
    return `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;gap:12px">
        <h3 style="margin:0">${escapeHtml(t.label)}</h3>
        <label class="checkbox-label" style="margin:0;font-size:12px;white-space:nowrap">
          <input type="checkbox" id="mt-enabled-${escapeHtml(t.key)}" ${t.enabled ? 'checked' : ''}>
          Activé
        </label>
      </div>
      <div class="card-body">
        <p style="font-size:12px;color:#888;margin:0 0 14px">${escapeHtml(t.description)}</p>
        <div class="form-group">
          <label>Objet du mail</label>
          <input type="text" id="mt-subject-${escapeHtml(t.key)}" value="${escapeHtml(t.subject)}">
        </div>
        <div class="form-group">
          <label>Contenu (HTML)</label>
          <textarea id="mt-body-${escapeHtml(t.key)}" rows="12" style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.5">${escapeHtml(t.body_html)}</textarea>
        </div>
        <div style="font-size:11px;color:#888;margin-bottom:14px">
          Variables disponibles — cliquez pour copier :
          ${vars.map(v => `<button type="button" class="btn btn-sm btn-outline" style="font-family:monospace;font-size:10px;padding:1px 5px;margin:2px 2px 0 0" onclick="apbCopyMailVar('${v}')">{${v}}</button>`).join('')}
        </div>
        <div class="form-actions" style="margin:0">
          <button class="btn btn-primary" onclick="saveMailTemplate('${escapeJsAttr(t.key)}')">Enregistrer ce message</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function apbCopyMailVar(name) {
  const text = '{' + name + '}';
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  showAlert('mails-alert', `${text} copié — collez-le dans le texte.`);
}

async function saveMailTemplate(key) {
  const subject  = document.getElementById('mt-subject-' + key).value.trim();
  const bodyHtml = document.getElementById('mt-body-' + key).value;
  const enabled  = document.getElementById('mt-enabled-' + key).checked;
  if (!subject || !bodyHtml.trim()) {
    showAlert('mails-alert', "L'objet et le contenu sont obligatoires.", 'error');
    return;
  }
  try {
    await apbApiFetch('/api/admin-mail-templates.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'update', key, subject, bodyHtml, enabled }),
    });
  } catch (e) {
    showAlert('mails-alert', adminApiErrorMessage(e), 'error');
    return;
  }
  showAlert('mails-alert', '✓ Message enregistré.');
}

// ===== STRIPE CONFIG (read-only display -- the real values live server-side
// in site/api/_lib/config.php; site/api/public-config.php serves only the
// publishable half) =====
async function renderBookingConfig() {
  const webhookEl = document.getElementById('webhook-url');
  if (webhookEl) webhookEl.value = location.origin + '/api/stripe-webhook.php';

  const pkEl = document.getElementById('stripe-pk-display');
  if (!pkEl) return;
  try {
    const cfg = await apbApiFetch('/api/public-config.php');
    pkEl.value = cfg.stripePublishableKey || '(non configurée)';
  } catch (e) {
    pkEl.value = 'Indisponible (API injoignable sur ce déploiement)';
  }
}

function copyWebhook() {
  const el = document.getElementById('webhook-url');
  if (el) {
    navigator.clipboard.writeText(el.value).then(() => showAlert('schedule-alert', '✓ URL copiée.')).catch(() => { el.select(); document.execCommand('copy'); });
  }
}

// ===== BOOKING LIST =====
function renderBookingList() {
  const all      = getBookings();
  const statusF  = document.getElementById('bl-filter-status')?.value || 'all';
  const typeF    = document.getElementById('bl-filter-type')?.value   || 'all';
  const search   = (document.getElementById('bl-search')?.value || '').toLowerCase();

  let list = all.filter(b => {
    if (statusF !== 'all' && b.status !== statusF) return false;
    if (typeF   !== 'all' && b.paymentType !== typeF) return false;
    if (search) {
      const hay = `${b.id} ${b.clientFirstName} ${b.clientLastName} ${b.clientEmail} ${b.slotTitle}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  }).sort((a,b) => (b.createdAt || b.bookedAt || '').localeCompare(a.createdAt || a.bookedAt || ''));

  const confirmed   = all.filter(b => b.status === 'confirmed').length;
  const pending     = all.filter(b => b.status === 'pending').length;
  const revenue     = all.filter(b => b.status === 'confirmed' && b.paymentType === 'stripe').reduce((s,b) => s + (b.totalPaid || 0), 0);
  document.getElementById('bl-stats').innerHTML = `
    <div class="stat-card" style="flex:1;min-width:140px"><div class="stat-num">${all.length}</div><div class="stat-lbl">Total réservations</div></div>
    <div class="stat-card" style="flex:1;min-width:140px"><div class="stat-num">${confirmed}</div><div class="stat-lbl">Confirmées</div></div>
    ${pending ? `<div class="stat-card" style="flex:1;min-width:140px;border-color:#F0D88C"><div class="stat-num" style="color:#856404">${pending}</div><div class="stat-lbl">En attente</div></div>` : ''}
    <div class="stat-card dark" style="flex:1;min-width:140px"><div class="stat-num">${revenue}€</div><div class="stat-lbl">CA carte (confirmées)</div></div>
  `;

  if (!list.length) {
    document.getElementById('bookings-tbody').innerHTML = `<tr><td colspan="8" style="text-align:center;color:#bbb;padding:32px;font-style:italic">Aucune réservation${search || statusF !== 'all' ? ' pour ces filtres' : ''}.</td></tr>`;
    return;
  }

  const bookRow = b => {
    const loc    = (LOCATIONS && LOCATIONS[b.slotLocation || 'assas']) ? LOCATIONS[b.slotLocation || 'assas'].short : (b.slotLocation || '—');
    const isPast = new Date(b.courseDate + 'T' + (b.slotEnd||'23:59') + ':00') < new Date();
    const statusColor = b.status === 'cancelled' ? '#c0392b' : b.status === 'pending' ? '#856404' : isPast ? '#999' : '#2E6B30';
    const statusLabel = b.status === 'cancelled' ? 'Annulé' : b.status === 'pending' ? '⏳ En attente' : isPast ? 'Passé' : 'Confirmé';
    return `<tr>
      <td style="font-size:11px;letter-spacing:.06em;color:#888">${b.id}</td>
      <td>
        <div style="font-size:13px;cursor:pointer;color:var(--accent)" onclick="showStudentProfile('${escapeJsAttr(b.clientEmail)}')">${escapeHtml(b.clientFirstName)} ${escapeHtml(b.clientLastName)}</div>
        <div style="font-size:11px;color:#aaa">${escapeHtml(b.clientEmail)}</div>
      </td>
      <td style="font-size:12px;max-width:160px">${escapeHtml((b.slotTitle||'').replace('Cours ',''))}</td>
      <td style="font-size:12px;white-space:nowrap">${new Date(b.courseDate+'T12:00:00').toLocaleDateString('fr-FR')} ${b.slotStart}</td>
      <td style="font-size:11px;color:#888">${loc}</td>
      <td>
        ${b.paymentType === 'carnet'
          ? `<span style="font-size:11px;color:#2E6B30">Carnet</span>`
          : b.paymentType === 'onsite'
          ? `<span style="font-size:11px;color:#8a5a00">Sur place</span><div style="font-size:10px;color:#888">${b.totalPaid || 0}€</div>`
          : `<span style="font-size:11px">Carte</span><div style="font-size:10px;color:#888">${b.totalPaid || 0}€</div>`}
      </td>
      <td><span style="font-size:11px;font-weight:500;color:${statusColor}">${statusLabel}</span></td>
      <td class="actions" style="white-space:nowrap">
        <button class="btn btn-sm btn-outline" onclick="editBooking('${b.id}')">Modifier</button>
        <button class="btn btn-sm btn-outline" onclick="adminPrintInvoiceBooking('${b.id}')" title="Facture">🧾</button>
        ${(b.status === 'confirmed' || b.status === 'pending') && !isPast ? `<button class="btn btn-sm btn-danger" onclick="adminCancelBooking('${b.id}')">Annuler</button>` : ''}
      </td>
    </tr>`;
  };
  const upcoming = list.filter(b => b.status !== 'cancelled' && new Date(b.courseDate+'T'+(b.slotEnd||'23:59')+':00') >= new Date()).sort((a,b) => a.courseDate.localeCompare(b.courseDate));
  const past     = list.filter(b => b.status === 'cancelled' || new Date(b.courseDate+'T'+(b.slotEnd||'23:59')+':00') < new Date()).sort((a,b) => b.courseDate.localeCompare(a.courseDate));
  const bSep = label => `<tr><td colspan="8" style="background:var(--dark);color:rgba(255,255,255,.5);font-size:9px;letter-spacing:.2em;text-transform:uppercase;padding:5px 14px">${label}</td></tr>`;
  let bRows = '';
  if (upcoming.length) bRows += bSep(`À venir — ${upcoming.length}`) + upcoming.map(bookRow).join('');
  if (past.length)     bRows += bSep(`Passés / Annulés — ${past.length}`) + past.map(bookRow).join('');
  document.getElementById('bookings-tbody').innerHTML = bRows;
}

// ===== NOUVELLE RÉSERVATION (inscrire un élève à un cours) =====
// Passe par /api/admin-book.php -> api_book_slot (même transaction que le
// parcours client : capacité, absence prof, fermeture 1h avant). L'élève doit
// avoir un compte existant ; le paiement est enregistré comme « sur place ».
function nbKnownClients() {
  const map = new Map();
  [...getBookings(), ...getCarnets()].forEach(o => {
    const email = (o.clientEmail || '').trim();
    if (!email) return;
    const key = email.toLowerCase();
    if (!map.has(key)) map.set(key, { email, name: getClientName(o) });
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function nbUnitPrice(type) {
  const t = getTarifs().find(x => x.type === type && !x.isCarnet);
  return t ? `${t.price}€` : '—';
}

function nbSelectedSlot() {
  const id = parseInt(document.getElementById('nb-slot').value);
  return apbBookableSlots().find(s => s.id === id) || null;
}

// Ouvrable depuis le planning avec un cours et une date déjà choisis :
// « Inscrire un élève » sur une séance précise évite de les resélectionner,
// et c'est ce qui rend l'inscription à l'unité payée sur place trouvable
// ailleurs que dans l'onglet Réservations.
let nbPreset = null;

async function openNewBookingModal(presetSlotId, presetDate) {
  document.getElementById('nb-alert').innerHTML = '';
  document.getElementById('nb-client-list').innerHTML =
    nbKnownClients().map(c => `<option value="${escapeHtml(c.email)}">${escapeHtml(c.name)}</option>`).join('');
  document.getElementById('nb-client').value = '';
  nbPreset = presetSlotId ? { slotId: presetSlotId, courseDate: presetDate } : null;

  await apbLoadRetiredSlots();
  // Les cours retirés en fin de liste : ils ne servent qu'au rétroactif.
  const slots = apbBookableSlots().sort((a, b) =>
    (!!a.retired - !!b.retired) || a.day - b.day || a.start.localeCompare(b.start)
  );
  const locShort = s => (LOCATIONS && LOCATIONS[s.location || 'assas']) ? LOCATIONS[s.location || 'assas'].short : (s.location || '');
  document.getElementById('nb-slot').innerHTML = slots.map(s =>
    `<option value="${s.id}">${DAYS[s.day]} ${s.start}–${s.end} — ${escapeHtml(s.title)} (${escapeHtml(locShort(s))})${apbSlotRetiredLabel(s)}</option>`
  ).join('');
  if (presetSlotId) document.getElementById('nb-slot').value = presetSlotId;

  nbOnSlotChange();
  if (presetDate) {
    const sel = document.getElementById('nb-date');
    if ([...sel.options].some(o => o.value === presetDate)) {
      sel.value = presetDate;
      apbUpdateRetroNote('nb');
    }
  }
  document.getElementById('booking-modal-overlay').classList.add('open');
}

function closeNewBookingModal() {
  document.getElementById('booking-modal-overlay').classList.remove('open');
}

// ===== COURS RETIRÉS DU PLANNING (inscription rétroactive) =====
// Une séance déjà passée a pu avoir lieu sur un cours depuis retiré du
// planning (suppression douce, active=false -- voir admin-slots.php). Ces
// cours sont invisibles partout ailleurs, à dessein ; on ne les charge que
// pour les deux modales d'inscription, et seulement sur une date passée
// api_book_slot() les accepte (p_allow_past).
let apbRetiredSlotsCache = null;

async function apbLoadRetiredSlots() {
  if (apbRetiredSlotsCache) return apbRetiredSlotsCache;
  try {
    const resp = await apbApiFetch('/api/admin-slots.php?include_inactive=1');
    apbRetiredSlotsCache = (resp.slots || []).filter(r => !r.active).map(r => ({
      id: r.id, day: r.day_of_week, start: r.start_time.slice(0, 5), end: r.end_time.slice(0, 5),
      title: r.title, type: r.type, teacher: r.teacher_name, teacherId: r.teacher_id,
      location: r.location_key, capacity: r.capacity, priceCents: r.price_cents, retired: true,
    }));
  } catch (e) {
    // L'inscription sur les cours actifs doit marcher même si cet appel échoue.
    console.warn('apbLoadRetiredSlots failed:', e);
    apbRetiredSlotsCache = [];
  }
  return apbRetiredSlotsCache;
}

/** Cours proposables dans les modales : le planning actuel + les cours retirés. */
function apbBookableSlots() {
  return [...getSlots(), ...(apbRetiredSlotsCache || [])];
}

/** Suffixe d'étiquette : distingue un cours retiré dans les listes déroulantes. */
function apbSlotRetiredLabel(s) {
  return s.retired ? ' — retiré du planning' : '';
}

// Remplit une liste déroulante avec les occurrences réelles du cours (même
// jour de semaine, chaque semaine). Empêche de choisir une date qui ne
// correspond pas au créneau -- ce qui déréglait l'agenda.
//
// Les dates passées sont proposées aussi, pour inscrire rétroactivement (une
// séance oubliée sur un carnet, une élève venue sans réserver). Seul l'admin
// peut les valider : api_book_slot() ne lève la fermeture à 1h que sur
// p_allow_past, que seul admin-book.php passe
// (supabase/migrations/0011_retroactive_booking.sql).
//
// getNextOccurrence() exclut le jour même, donc la date du jour arrive par la
// branche « passées » -- mais elle est regroupée avec les suivantes, un cours
// de ce soir n'étant pas une séance passée.
function apbFillOccurrences(selectId, slot, count = 12, pastCount = 12) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  if (!slot) { sel.innerHTML = ''; return; }

  const next = getNextOccurrence(slot.day);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const option = d =>
    `<option value="${formatDateISO(d)}">`
    + d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    + '</option>';

  let past = '', upcoming = '';
  for (let i = -pastCount; i < count; i++) {
    const d = new Date(next); d.setDate(next.getDate() + i * 7);
    if (d < today) past += option(d); else upcoming += option(d);
  }

  sel.innerHTML =
    (past ? `<optgroup label="Séances passées (inscription rétroactive)">${past}</optgroup>` : '')
    + `<optgroup label="À venir">${upcoming}</optgroup>`;
  // Défaut inchangé : la prochaine occurrence à venir, jamais une date passée.
  sel.value = formatDateISO(next);
  apbUpdateRetroNote(selectId.replace(/-date$/, ''));
}

// Une fois la date choisie, la liste n'affiche plus que « mercredi 9
// septembre » : rien ne dit que c'est une séance passée. D'où ce rappel, qui
// évite d'enregistrer une date passée par inadvertance.
function apbUpdateRetroNote(prefix) {
  const note = document.getElementById(prefix + '-retro-note');
  const sel = document.getElementById(prefix + '-date');
  if (!note || !sel) return;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isPast = sel.value && new Date(sel.value + 'T00:00:00') < today;
  note.hidden = !isPast;
  note.textContent = isPast
    ? 'Séance passée : elle sera enregistrée rétroactivement, comme si elle avait été réservée à l\'époque.'
    : '';
}

// Sélection d'un cours : liste ses prochaines occurrences + récap.
function nbOnSlotChange() {
  const slot = nbSelectedSlot();
  apbFillOccurrences('nb-date', slot);
  document.getElementById('nb-summary').innerHTML = slot
    ? `Paiement : <strong>payé sur place</strong> · Tarif indicatif : <strong>${nbUnitPrice(slot.type)}</strong>`
    : '';
}

async function saveNewBooking() {
  const clientEmail = document.getElementById('nb-client').value.trim();
  const slot        = nbSelectedSlot();
  const courseDate  = document.getElementById('nb-date').value;
  if (!clientEmail) { showAlert('nb-alert', 'Veuillez indiquer l\'élève.', 'error'); return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clientEmail)) {
    showAlert('nb-alert', 'Sélectionnez l\'élève par son email (un compte existant est requis).', 'error'); return;
  }
  if (!slot)       { showAlert('nb-alert', 'Veuillez choisir un cours.', 'error'); return; }
  if (!courseDate) { showAlert('nb-alert', 'Veuillez choisir la date du cours.', 'error'); return; }

  try {
    await apbApiFetch('/api/admin-book.php', {
      method: 'POST',
      body: JSON.stringify({ clientEmail, slotId: slot.id, courseDate }),
    });
    await syncAdminDataFromApi();
    closeNewBookingModal();
    apbRerenderCurrentPage();
    showAlert('bookings-alert', '✓ Élève inscrit au cours (payé sur place).');
    if (nbPreset) { nbPreset = null; openOccurrenceModal(slot.id, courseDate); }
  } catch (e) {
    showAlert('nb-alert', (typeof adminApiErrorMessage === 'function' ? adminApiErrorMessage(e) : `Erreur : ${e.message}`), 'error');
  }
}

async function adminCancelBooking(id) {
  const b = getBookings().find(x => x.id === id);
  if (!b) return;
  const isStripe   = b.paymentType === 'stripe';
  const carnetNote = b.paymentType === 'carnet' ? '\nLa séance sera restituée sur le carnet.' : '';
  const refundNote = isStripe ? `\n💳 Un remboursement de ${b.totalPaid || 0}€ devra être effectué au client.` : '';
  if (!confirm(`Annuler la réservation ${id} ?\nClient : ${b.clientFirstName} ${b.clientLastName}${carnetNote}${refundNote}`)) return;

  try {
    await apbApiFetch('/api/admin-bookings.php', { method: 'POST', body: JSON.stringify({ action: 'cancel', bookingId: id }) });
    await syncAdminDataFromApi();
  } catch (e) {
    // Refused (a 403 from a session replaced by a client login, say) or
    // server unreachable: the booking still stands, don't report it cancelled.
    showAlert('bookings-alert', adminApiErrorMessage(e), 'error');
    return;
  }
  apbRerenderCurrentPage();
  const msg = isStripe
    ? `✓ Réservation annulée. Pensez à rembourser <strong>${b.totalPaid || 0}€</strong> au client.`
    : `✓ Réservation ${id} annulée.${b.paymentType === 'carnet' ? ' Séance restituée.' : ''}`;
  showAlert('bookings-alert', msg);
}

/** Rerend la page ouverte : un déplacement se voit dans les Réservations comme dans le Planning. */
function apbRerenderCurrentPage() {
  const active = document.querySelector('.page.active');
  if (active) renderCurrentPage(active.id.replace(/^page-/, ''));
}

function ebSelectedSlot() {
  const id = parseInt(document.getElementById('eb-slot').value);
  return apbBookableSlots().find(s => s.id === id) || null;
}

function ebOnSlotChange() {
  apbFillOccurrences('eb-date', ebSelectedSlot());
}

// ===== DÉPLACER UNE RÉSERVATION (changer son cours et/ou sa date) =====
// Passe par /api/admin-bookings.php (action 'update') -> api_move_booking,
// qui verrouille l'occurrence quittée et celle rejointe dans la même
// transaction : capacité, absence du professeur et discipline du carnet sont
// vérifiées comme à l'inscription.
//
// Jusqu'ici cette modale n'écrivait que dans localStorage : elle affichait
// « ✓ Réservation modifiée » et la base ne bougeait pas (voir
// supabase/migrations/0012_move_booking.sql).
//
// Deux choses ont disparu au passage :
//   - le mode « Personnalisé » (intitulé, horaire et professeur libres). Une
//     réservation pointe sur une occurrence, qui pointe sur un cours réel :
//     il n'y a pas de place en base pour une séance sans cours. Le vrai
//     besoin derrière ce mode — une séance sur un cours qui n'est plus au
//     planning — est couvert par les cours retirés, toujours proposés ici.
//   - le champ date libre, remplacé par les occurrences réelles du cours
//     (apbFillOccurrences), les mêmes que dans « Nouvelle réservation » :
//     on ne peut plus choisir une date où le cours ne tourne pas.
async function editBooking(id) {
  const b = getBookings().find(x => x.id === id);
  if (!b) return;
  await apbLoadRetiredSlots();

  let modal = document.getElementById('edit-booking-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'edit-booking-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow-y:auto';
    document.body.appendChild(modal);
  }

  const locShort = s => (LOCATIONS && LOCATIONS[s.location || 'assas']) ? LOCATIONS[s.location || 'assas'].short : (s.location || '');
  const slots = apbBookableSlots().sort((a, b2) =>
    (!!a.retired - !!b2.retired) || a.day - b2.day || a.start.localeCompare(b2.start)
  );
  const slotOptions = slots.map(s =>
    `<option value="${s.id}"${s.id === b.slotId ? ' selected' : ''}>${DAYS[s.day]} ${s.start}–${s.end} — ${escapeHtml(s.title)} (${escapeHtml(locShort(s))})${apbSlotRetiredLabel(s)}</option>`
  ).join('');

  modal.innerHTML = `
    <div style="background:#fff;max-width:540px;width:100%;position:relative;max-height:90vh;overflow-y:auto">
      <div style="background:#373737;color:#fff;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:1">
        <div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300">Modifier la réservation</div>
        <button onclick="document.getElementById('edit-booking-modal').remove()" style="background:none;border:none;color:#fff;font-size:24px;cursor:pointer;line-height:1">×</button>
      </div>
      <div style="padding:24px">
        <div style="font-size:10px;color:#aaa;letter-spacing:.1em;text-transform:uppercase;margin-bottom:20px">${escapeHtml(id)}</div>

        <div style="background:#faf9f6;border:1px solid var(--border);padding:12px 16px;margin-bottom:16px;font-size:13px">
          <div style="font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#aaa;margin-bottom:6px">Actuellement</div>
          <div style="font-weight:500">${escapeHtml(b.slotTitle || '')}</div>
          <div style="color:#888;font-size:12px;margin-top:2px">${escapeHtml(b.courseDate || '')} · ${escapeHtml(b.slotStart || '')}–${escapeHtml(b.slotEnd || '')}</div>
        </div>

        <div class="form-group">
          <label>Cours</label>
          <select id="eb-slot" onchange="ebOnSlotChange()">${slotOptions}</select>
        </div>

        <div class="form-group">
          <label>Date du cours</label>
          <select id="eb-date" onchange="apbUpdateRetroNote('eb')"></select>
          <div id="eb-retro-note" hidden style="margin-top:6px;font-size:11px;color:#b07a00"></div>
        </div>

        <div style="background:#faf9f6;border:1px solid var(--border);padding:12px 16px;margin-bottom:16px;font-size:13px">
          <div style="font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#aaa;margin-bottom:6px">Client — modifiable depuis la fiche client</div>
          <div style="font-weight:500">${escapeHtml(b.clientFirstName || '')} ${escapeHtml(b.clientLastName || '')}</div>
          <div style="color:#888;font-size:12px;margin-top:2px">${escapeHtml(b.clientEmail || '')}${b.clientPhone ? ' · ' + escapeHtml(b.clientPhone) : ''}</div>
        </div>

        <div id="eb-alert"></div>
        <div class="form-actions">
          <button class="btn btn-outline" onclick="document.getElementById('edit-booking-modal').remove()">Annuler</button>
          <button class="btn btn-primary" id="eb-save" onclick="saveBookingEdit('${escapeJsAttr(id)}')">Enregistrer</button>
        </div>
      </div>
    </div>`;

  // Les occurrences dépendent du cours sélectionné ; on repositionne ensuite
  // sur la date actuelle de la réservation si elle est dans la liste.
  ebOnSlotChange();
  const dateSel = document.getElementById('eb-date');
  if (dateSel && [...dateSel.options].some(o => o.value === b.courseDate)) {
    dateSel.value = b.courseDate;
    apbUpdateRetroNote('eb');
  }

  modal.style.display = 'flex';
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

async function saveBookingEdit(id) {
  const slot       = ebSelectedSlot();
  const courseDate = document.getElementById('eb-date').value;
  const alertEl    = document.getElementById('eb-alert');
  const btn        = document.getElementById('eb-save');
  if (!slot)       { alertEl.innerHTML = '<div class="alert alert-error">Choisissez un cours.</div>'; return; }
  if (!courseDate) { alertEl.innerHTML = '<div class="alert alert-error">Choisissez la date du cours.</div>'; return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement…'; }
  try {
    await apbApiFetch('/api/admin-bookings.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'update', bookingId: id, slotId: slot.id, courseDate }),
    });
    await syncAdminDataFromApi();
  } catch (e) {
    // Refusée (cours complet, professeur absent, session expirée) ou serveur
    // injoignable : la réservation n'a pas bougé, on ne dit pas le contraire.
    alertEl.innerHTML = `<div class="alert alert-error">${escapeHtml(adminApiErrorMessage(e))}</div>`;
    if (btn) { btn.disabled = false; btn.textContent = 'Enregistrer'; }
    return;
  }

  document.getElementById('edit-booking-modal').remove();
  apbRerenderCurrentPage();
  showAlert('bookings-alert', '✓ Réservation déplacée.');
}

// Neutralizes CSV/formula injection (CWE-1236): a client name/message starting with
// =, +, -, @ or a tab/CR would otherwise be executed as a formula when the exported
// file is opened in Excel/Sheets (e.g. clientFirstName = '=HYPERLINK("http://evil","x")').
function csvSafe(value) {
  const s = String(value ?? '');
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function exportBookingsCSV() {
  const bookings = getBookings();
  if (!bookings.length) { alert('Aucune réservation à exporter.'); return; }
  const headers = ['Référence','Prénom','Nom','Email','Téléphone','Cours','Date','Horaire','Lieu','Participants','Paiement','Code carnet','Montant','Statut','Créé le'];
  const rows = bookings.map(b => [
    b.id, b.clientFirstName, b.clientLastName, b.clientEmail, b.clientPhone || '',
    b.slotTitle, b.courseDate, `${b.slotStart}-${b.slotEnd}`,
    (LOCATIONS && LOCATIONS[b.slotLocation]) ? LOCATIONS[b.slotLocation].name : b.slotLocation,
    b.participants, b.paymentType, b.carnetCode || '',
    b.totalPaid || 0, b.status,
    new Date(b.createdAt).toLocaleString('fr-FR'),
  ].map(v => `"${csvSafe(v).replace(/"/g,'""')}"`));

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], {type:'text/csv;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'reservations.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ===== CARNETS =====
let lastGeneratedCode = null;

function renderCarnetsAdmin() {
  const carnets = getCarnets();
  const active  = carnets.filter(c => c.active && c.remainingSessions > 0);
  const badge   = document.getElementById('carnets-count');
  if (badge) badge.textContent = `${active.length} actif(s) / ${carnets.length} total`;

  // Populate tarif select with carnet-type tarifs only
  const tarifSel = document.getElementById('carnet-tarif-id');
  if (tarifSel) {
    const carnetTarifs = getTarifs().filter(t => t.isCarnet);
    tarifSel.innerHTML = '<option value="">— Choisir une formule carnet —</option>' +
      carnetTarifs.map(t => `<option value="${t.id}" data-sessions="${t.sessionCount}" data-months="${t.validityMonths}" data-name="${t.name}" data-type="${t.type}">${t.label} — ${t.name} (${t.sessionCount} séances — ${t.price}€)</option>`).join('');
  }

  // Sort: active first, then by creation desc
  const sorted = [...carnets].sort((a,b) => {
    if (a.active !== b.active) return b.active ? 1 : -1;
    return (b.createdAt || b.purchasedAt || '').localeCompare(a.createdAt || a.purchasedAt || '');
  });

  const now = new Date();
  const carnetRow = c => {
    const disc     = cbCarnetDiscipline(c);
    const expired  = c.expiresAt && new Date(c.expiresAt) < now;
    const depleted = c.remainingSessions <= 0;
    const statusColor = (!c.active || expired || depleted) ? '#c0392b' : '#2E6B30';
    const statusLabel = !c.active ? 'Désactivé' : expired ? 'Expiré' : depleted ? 'Épuisé' : 'Actif';
    return `<tr>
      <td style="font-family:monospace;font-size:12px;letter-spacing:.06em">${escapeHtml(c.code)}</td>
      <td>
        <div style="font-size:13px;cursor:pointer;color:var(--accent)" onclick="showStudentProfile('${escapeJsAttr(c.clientEmail)}')">${escapeHtml(getClientName(c))}</div>
        <div style="font-size:11px;color:#aaa">${escapeHtml(c.clientEmail)}</div>
      </td>
      <td><strong>${c.remainingSessions}</strong> / ${c.totalSessions}
        <div style="font-size:10px;color:#aaa">${escapeHtml(c.tarifName)}</div>
        <div style="font-size:10px;font-weight:500;background:#f2efe9;display:inline-block;padding:1px 6px;margin-top:3px">${escapeHtml(APB_TYPE_LABELS[disc] || disc || '—')}</div>
      </td>
      <td style="font-size:12px">${c.expiresAt || '—'}</td>
      <td><span style="font-size:11px;font-weight:500;color:${statusColor}">${statusLabel}</span></td>
      <td class="actions">
        ${(c.active && !expired && !depleted) ? `<button class="btn btn-sm btn-primary" onclick="openCarnetBookingModal('${escapeJsAttr(c.code)}')">Placer une séance</button>` : ''}
        <button class="btn btn-sm btn-outline" onclick="editCarnet('${c.code}')">Modifier</button>
        ${c.active ? `<button class="btn btn-sm btn-danger" onclick="deactivateCarnet('${c.code}')">Désact.</button>` : ''}
      </td>
    </tr>`;
  };
  const q = (document.getElementById('carnet-search')?.value || '').trim().toLowerCase();
  const match = c => !q || `${c.code} ${getClientName(c)} ${c.clientEmail || ''} ${c.tarifName || ''} ${APB_TYPE_LABELS[cbCarnetDiscipline(c)] || ''}`.toLowerCase().includes(q);
  const filtered  = sorted.filter(match);
  const activeC   = filtered.filter(c => c.active && c.remainingSessions > 0 && (!c.expiresAt || new Date(c.expiresAt) >= now));
  const inactiveC = filtered.filter(c => !c.active || c.remainingSessions <= 0 || (c.expiresAt && new Date(c.expiresAt) < now));
  const sepRow = label => `<tr><td colspan="6" style="background:var(--dark);color:rgba(255,255,255,.5);font-size:9px;letter-spacing:.2em;text-transform:uppercase;padding:5px 14px">${label}</td></tr>`;
  let rows = '';
  if (activeC.length)   rows += sepRow(`Actifs — ${activeC.length}`) + activeC.map(carnetRow).join('');
  if (inactiveC.length) rows += sepRow(`Épuisés / Expirés — ${inactiveC.length}`) + inactiveC.map(carnetRow).join('');
  document.getElementById('carnets-tbody').innerHTML = rows || `<tr><td colspan="6" style="text-align:center;color:#bbb;padding:24px;font-style:italic">${q ? 'Aucun carnet pour cette recherche.' : 'Aucun carnet créé.'}</td></tr>`;
}

// ===== PLACER UNE SÉANCE DE CARNET (réservation manuelle décomptée) =====
// Réserve un cours pour le titulaire du carnet en décomptant une séance, via
// /api/admin-book.php (paymentType 'carnet'). api_book_slot vérifie que le
// carnet correspond au client, est actif/non expiré, a une séance et est de
// la même discipline que le cours.
function cbFindCarnet(code) {
  return getCarnets().find(c => c.code === code) || null;
}

function cbSelectedSlot() {
  const id = parseInt(document.getElementById('cb-slot').value);
  return apbBookableSlots().find(s => s.id === id) || null;
}

const CB_TYPE_LABELS = APB_TYPE_LABELS;

// Discipline « achetée » du carnet : on privilégie le type de son tarif (fiable)
// et on retombe sur le type stocké. Sert à trier/étiqueter les cours proposés.
function cbCarnetDiscipline(c) {
  const tarif = getTarifs().find(t => String(t.id) === String(c.tarifId));
  return (tarif && tarif.type) || c.type || '';
}

async function openCarnetBookingModal(code) {
  const c = cbFindCarnet(code);
  if (!c) return;
  await apbLoadRetiredSlots();
  document.getElementById('cb-carnet-code').value = code;
  document.getElementById('cb-alert').innerHTML = '';

  const disc = cbCarnetDiscipline(c);
  const discLabel = CB_TYPE_LABELS[disc] || disc || '—';
  document.getElementById('cb-info').innerHTML =
    `<strong>${escapeHtml(getClientName(c))}</strong> — ${escapeHtml(c.clientEmail || '')}<br>`
    + `Carnet <span style="font-family:monospace">${escapeHtml(c.code)}</span> · `
    + `${c.remainingSessions}/${c.totalSessions} séance(s) restante(s)`
    + (c.tarifName ? ` · ${escapeHtml(c.tarifName)}` : '')
    + `<br>Discipline du carnet : <strong>${escapeHtml(discLabel)}</strong>`;

  // On propose tous les cours (jamais bloqué), mais ceux de la discipline du
  // carnet sont remontés en tête et l'étiquette de type est affichée. Le
  // décompte reste garanti côté serveur : api_book_slot n'accepte que si le
  // type du cours correspond à celui du carnet.
  const locShort = s => (LOCATIONS && LOCATIONS[s.location || 'assas']) ? LOCATIONS[s.location || 'assas'].short : (s.location || '');
  const slots = apbBookableSlots().sort((a, b) =>
    ((a.type === disc ? 0 : 1) - (b.type === disc ? 0 : 1))
    || (!!a.retired - !!b.retired) || a.day - b.day || a.start.localeCompare(b.start)
  );
  const sel = document.getElementById('cb-slot');
  sel.innerHTML = slots.map(s =>
    `<option value="${s.id}">[${CB_TYPE_LABELS[s.type] || s.type}] ${DAYS[s.day]} ${s.start}–${s.end} — ${escapeHtml(s.title)} (${escapeHtml(locShort(s))})${apbSlotRetiredLabel(s)}</option>`
  ).join('');
  document.getElementById('cb-slot-empty').style.display = slots.length ? 'none' : 'block';
  sel.style.display = slots.length ? '' : 'none';

  cbOnSlotChange();
  document.getElementById('carnet-booking-modal-overlay').classList.add('open');
}

function closeCarnetBookingModal() {
  document.getElementById('carnet-booking-modal-overlay').classList.remove('open');
}

function cbOnSlotChange() {
  apbFillOccurrences('cb-date', cbSelectedSlot());
}

async function saveCarnetBooking() {
  const c = cbFindCarnet(document.getElementById('cb-carnet-code').value);
  const slot = cbSelectedSlot();
  const courseDate = document.getElementById('cb-date').value;
  // Feedback shown INSIDE the modal (cb-alert), otherwise it lands in the
  // page's carnets-alert, hidden behind the open modal -> "rien ne se passe".
  if (!c || !c.id)  { showAlert('cb-alert', 'Carnet introuvable ou non synchronisé.', 'error'); return; }
  if (!slot)        { showAlert('cb-alert', 'Veuillez choisir un cours.', 'error'); return; }
  if (!courseDate)  { showAlert('cb-alert', 'Veuillez choisir la date du cours.', 'error'); return; }

  const btn = document.getElementById('cb-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Placement…'; }
  try {
    await apbApiFetch('/api/admin-book.php', {
      method: 'POST',
      body: JSON.stringify({ clientEmail: c.clientEmail, slotId: slot.id, courseDate, carnetId: c.id }),
    });
    await syncAdminDataFromApi();
    closeCarnetBookingModal();
    renderCarnetsAdmin();
    if (typeof renderBookingList === 'function') renderBookingList();
    showAlert('carnets-alert', '✓ Séance placée. Le carnet a été décompté.');
  } catch (e) {
    showAlert('cb-alert', (typeof adminApiErrorMessage === 'function' ? adminApiErrorMessage(e) : `Erreur : ${e.message}`), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Placer la séance'; }
  }
}

function updateCarnetFormFromTarif() {
  const sel = document.getElementById('carnet-tarif-id');
  const opt = sel.options[sel.selectedIndex];
  if (!opt.value) return;
  const sessions = parseInt(opt.dataset.sessions) || 0;
  const months   = parseInt(opt.dataset.months)   || 0;
  if (opt.dataset.type) document.getElementById('carnet-type').value = opt.dataset.type;
  document.getElementById('carnet-sessions').value   = sessions;
  document.getElementById('carnet-remaining').value  = sessions;
  if (months) {
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + months);
    document.getElementById('carnet-expires').value = formatDateISO(expiry);
  }
}

async function saveCarnet() {
  const editCode = document.getElementById('carnet-edit-code').value;
  const tarifSel = document.getElementById('carnet-tarif-id');
  const tarifOpt = tarifSel.options[tarifSel.selectedIndex];
  const name     = document.getElementById('carnet-client-name').value.trim();
  const email    = document.getElementById('carnet-client-email').value.trim();
  const total    = parseInt(document.getElementById('carnet-sessions').value)  || 0;
  const remain   = parseInt(document.getElementById('carnet-remaining').value) || 0;
  const expires  = document.getElementById('carnet-expires').value;

  if (!name || !email) { showAlert('carnets-alert', 'Nom et email obligatoires.', 'error'); return; }
  if (!total)          { showAlert('carnets-alert', 'Nombre de séances invalide.', 'error'); return; }

  const nameParts = name.split(' ');
  const firstName = nameParts[0] || '';
  const lastName  = nameParts.slice(1).join(' ') || '';

  if (editCode) {
    const existing = getCarnets().find(c => c.code === editCode);
    if (existing && existing.id) {
      try {
        await apbApiFetch('/api/admin-carnets.php', { method: 'POST', body: JSON.stringify({
          action: 'update', carnetId: existing.id, sessionCount: total, remainingSessions: remain,
          expiresAt: expires || undefined, active: remain > 0, email, firstName, lastName,
          type: document.getElementById('carnet-type').value,
        }) });
        await syncAdminDataFromApi();
        showAlert('carnets-alert', `✓ Carnet ${editCode} mis à jour.`);
        resetCarnetForm();
        renderCarnetsAdmin();
        return;
      } catch (e) {
        showAlert('carnets-alert', `Erreur : ${e.message}`, 'error');
        return;
      }
    }
    // Local-only demo carnet (no real API id) -- old local-only path.
    let carnets = getCarnets();
    const idx = carnets.findIndex(c => c.code === editCode);
    if (idx !== -1) {
      carnets[idx].clientName = name; carnets[idx].clientEmail = email;
      carnets[idx].totalSessions = total; carnets[idx].remainingSessions = remain;
      carnets[idx].expiresAt = expires || null; carnets[idx].active = remain > 0;
      saveCarnets(carnets);
      showAlert('carnets-alert', `✓ Carnet ${editCode} mis à jour.`);
      resetCarnetForm();
      renderCarnetsAdmin();
    }
    return;
  }

  const tarif = getTarifs().find(t => String(t.id) === String(tarifOpt.value));
  try {
    const created = await apbApiFetch('/api/admin-carnets.php', { method: 'POST', body: JSON.stringify({
      action: 'create', email, firstName, lastName,
      tarifId: tarifOpt.value ? parseInt(tarifOpt.value) : null,
      tarifName: tarifOpt.value ? tarifOpt.dataset.name : 'Manuel',
      type: document.getElementById('carnet-type').value || (tarif ? tarif.type : 'collectif'),
      sessionCount: total, remainingSessions: remain, validityMonths: parseInt(tarifOpt.dataset.months) || 6,
      totalPaidCents: 0,
    }) });
    await syncAdminDataFromApi();
    lastGeneratedCode = created.code;
    document.getElementById('generated-code').textContent = created.code;
    document.getElementById('generated-code-block').style.display = 'block';
    showAlert('carnets-alert', `✓ Carnet créé. Transmettez le code au client.`);
    renderCarnetsAdmin();
  } catch (e) {
    // No code to hand out: the carnet wasn't created.
    showAlert('carnets-alert', adminApiErrorMessage(e), 'error');
  }
}

function editCarnet(code) {
  const c = getCarnets().find(x => x.code === code);
  if (!c) return;
  document.getElementById('carnet-edit-code').value    = c.code;
  document.getElementById('carnet-client-name').value  = getClientName(c);
  document.getElementById('carnet-client-email').value = c.clientEmail;
  document.getElementById('carnet-sessions').value     = c.totalSessions;
  document.getElementById('carnet-remaining').value    = c.remainingSessions;
  document.getElementById('carnet-expires').value      = c.expiresAt || '';
  document.getElementById('carnet-tarif-id').value     = c.tarifId || '';
  document.getElementById('carnet-type').value         = cbCarnetDiscipline(c) || c.type || 'collectif';
  document.getElementById('carnet-form-title').textContent = `Modifier — ${c.code}`;
  document.getElementById('carnet-save-btn').textContent   = 'Enregistrer les modifications';
  document.getElementById('generated-code-block').style.display = 'none';
  document.getElementById('carnet-form-title').scrollIntoView({behavior:'smooth', block:'nearest'});
}

async function deactivateCarnet(code) {
  if (!confirm(`Désactiver le carnet ${code} ?`)) return;
  const existing = getCarnets().find(c => c.code === code);
  if (existing && existing.id) {
    try {
      await apbApiFetch('/api/admin-carnets.php', { method: 'POST', body: JSON.stringify({ action: 'deactivate', carnetId: existing.id }) });
      await syncAdminDataFromApi();
      renderCarnetsAdmin();
      showAlert('carnets-alert', `Carnet ${code} désactivé.`);
      return;
    } catch (e) {
      showAlert('carnets-alert', adminApiErrorMessage(e), 'error');
      return;
    }
  }
  // Local-only demo carnet.
  let carnets = getCarnets();
  const idx = carnets.findIndex(c => c.code === code);
  if (idx !== -1) { carnets[idx].active = false; saveCarnets(carnets); }
  renderCarnetsAdmin();
  showAlert('carnets-alert', `Carnet ${code} désactivé.`);
}

function resetCarnetForm() {
  document.getElementById('carnet-edit-code').value    = '';
  document.getElementById('carnet-client-name').value  = '';
  document.getElementById('carnet-client-email').value = '';
  document.getElementById('carnet-sessions').value     = '';
  document.getElementById('carnet-remaining').value    = '';
  document.getElementById('carnet-expires').value      = '';
  document.getElementById('carnet-tarif-id').value     = '';
  document.getElementById('carnet-type').value         = 'collectif';
  document.getElementById('carnet-form-title').textContent = 'Créer un carnet';
  document.getElementById('carnet-save-btn').textContent   = 'Générer le carnet';
  document.getElementById('generated-code-block').style.display = 'none';
}

function copyCode() {
  const code = document.getElementById('generated-code').textContent;
  navigator.clipboard.writeText(code).then(() => showAlert('carnets-alert', '✓ Code copié.')).catch(() => {});
}

// ===== PROFIL ÉLÈVE =====
function showStudentProfile(email) {
  const bookings = getBookings().filter(b => b.clientEmail && b.clientEmail.toLowerCase() === email.toLowerCase())
    .sort((a,b) => b.courseDate.localeCompare(a.courseDate));
  const carnets  = getCarnets().filter(c => c.clientEmail && c.clientEmail.toLowerCase() === email.toLowerCase());
  const b0 = bookings[0] || carnets[0] || {};
  const name  = getClientName(b0);
  const phone = b0.clientPhone || '—';
  let firstName = b0.clientFirstName || '';
  let lastName  = b0.clientLastName  || '';
  if (!firstName && !lastName && b0.clientName) {
    const parts = b0.clientName.trim().split(' ');
    firstName = parts[0] || '';
    lastName  = parts.slice(1).join(' ') || '';
  }

  const upcoming = bookings.filter(b => b.status === 'confirmed' && new Date(b.courseDate+'T23:59:00') >= new Date());
  const past     = bookings.filter(b => b.status !== 'confirmed' || new Date(b.courseDate+'T23:59:00') < new Date());

  const bookingRows = (list) => list.map(b => {
    const isPast = new Date(b.courseDate+'T23:59:00') < new Date();
    const sc = b.status === 'cancelled' ? '#c0392b' : isPast ? '#999' : '#2E6B30';
    const sl = b.status === 'cancelled' ? 'Annulé' : isPast ? 'Passé' : 'Confirmé';
    return `<tr>
      <td style="font-size:11px;color:#888">${new Date(b.courseDate+'T12:00:00').toLocaleDateString('fr-FR')} ${b.slotStart}</td>
      <td style="font-size:12px">${(b.slotTitle||'').replace('Cours ','')}</td>
      <td style="font-size:11px;color:${b.paymentType==='carnet'?'#2E6B30':'#666'}">${b.paymentType==='carnet'?'Carnet':'Carte'}</td>
      <td style="font-size:11px;font-weight:500;color:${sc}">${sl}</td>
      <td class="actions" style="white-space:nowrap">
        ${b.status === 'confirmed' && !isPast
          ? `<button class="btn btn-sm btn-danger" onclick="adminCancelBooking('${b.id}');showStudentProfile('${escapeJsAttr(email)}')">Annuler</button>`
          : ''}
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="5" style="color:#bbb;padding:12px;font-style:italic">Aucune réservation</td></tr>`;

  const carnetRows = carnets.map(c => {
    const expired  = c.expiresAt && new Date(c.expiresAt) < new Date();
    const sc = (!c.active || expired || c.remainingSessions <= 0) ? '#c0392b' : '#2E6B30';
    const sl = !c.active ? 'Désactivé' : expired ? 'Expiré' : c.remainingSessions <= 0 ? 'Épuisé' : 'Actif';
    return `<tr>
      <td style="font-family:monospace;font-size:12px">${escapeHtml(c.code)}</td>
      <td>${escapeHtml(c.tarifName || '—')}</td>
      <td><strong>${c.remainingSessions}</strong> / ${c.totalSessions}</td>
      <td style="font-size:12px">${c.expiresAt || '—'}</td>
      <td style="font-size:11px;font-weight:500;color:${sc}">${sl}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="5" style="color:#bbb;padding:12px;font-style:italic">Aucun carnet</td></tr>`;

  let modal = document.getElementById('student-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'student-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow-y:auto';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="background:#fff;max-width:820px;width:100%;padding:0;position:relative">
      <div style="background:#373737;color:#fff;padding:20px 24px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:300">${escapeHtml(name.trim() || email)}</div>
          <div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:4px">${escapeHtml(email)} · ${escapeHtml(phone)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
          <button onclick="document.getElementById('client-edit-zone').style.display=document.getElementById('client-edit-zone').style.display==='none'?'block':'none'"
            style="background:none;border:1px solid rgba(255,255,255,.3);color:rgba(255,255,255,.8);font-size:10px;letter-spacing:.1em;text-transform:uppercase;padding:6px 14px;cursor:pointer;font-family:inherit">Modifier</button>
          <button onclick="document.getElementById('student-modal').remove()" style="background:none;border:none;color:#fff;font-size:24px;cursor:pointer;line-height:1;padding:0">×</button>
        </div>
      </div>
      <div id="client-edit-zone" style="display:none;padding:20px 24px;border-bottom:1px solid var(--border);background:#faf9f6">
        <div class="form-row">
          <div class="form-group"><label>Prénom</label><input type="text" id="ce-firstname" value="${escapeHtml(firstName)}"></div>
          <div class="form-group"><label>Nom</label><input type="text" id="ce-lastname" value="${escapeHtml(lastName)}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Téléphone</label><input type="tel" id="ce-phone" value="${escapeHtml(phone !== '—' ? phone : '')}"></div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="ce-email" value="${escapeHtml(email)}">
            <small>Changer l'email modifie l'identifiant de connexion</small>
          </div>
        </div>
        <div id="ce-alert"></div>
        <div class="form-actions" style="margin-top:4px">
          <button class="btn btn-primary" onclick="saveClientEdit('${escapeJsAttr(email)}')">Enregistrer</button>
          <button class="btn btn-outline" onclick="document.getElementById('client-edit-zone').style.display='none'">Annuler</button>
        </div>
      </div>
      <div style="padding:20px 24px;overflow-x:auto">
        ${upcoming.length ? `<div style="margin-bottom:12px">
          <button class="btn btn-danger" onclick="adminCancelStudent('${escapeJsAttr(email)}')" style="font-size:11px">
            Annuler tous les cours à venir (${upcoming.length})
          </button>
        </div>` : ''}
        <h3 style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#888;margin:0 0 10px">Cours à venir</h3>
        <div style="overflow-x:auto;margin-bottom:20px"><table class="table"><thead><tr><th>Date</th><th>Cours</th><th>Paiement</th><th>Statut</th><th></th></tr></thead><tbody>${bookingRows(upcoming)}</tbody></table></div>
        <h3 style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#888;margin:0 0 10px">Historique</h3>
        <div style="overflow-x:auto;margin-bottom:20px"><table class="table"><thead><tr><th>Date</th><th>Cours</th><th>Paiement</th><th>Statut</th><th></th></tr></thead><tbody>${bookingRows(past)}</tbody></table></div>
        <h3 style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#888;margin:0 0 10px">Carnets</h3>
        <div style="overflow-x:auto"><table class="table"><thead><tr><th>Code</th><th>Formule</th><th>Séances</th><th>Expire</th><th>Statut</th></tr></thead><tbody>${carnetRows}</tbody></table></div>
      </div>
    </div>`;

  modal.style.display = 'flex';
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

async function adminCancelStudent(email) {
  const upcoming = getBookings().filter(b =>
    b.clientEmail && b.clientEmail.toLowerCase() === email.toLowerCase() &&
    b.status === 'confirmed' && new Date(b.courseDate+'T23:59:00') >= new Date()
  );
  if (!upcoming.length) return;
  if (!confirm(`Annuler les ${upcoming.length} réservation(s) à venir de cet élève ?`)) return;
  // One at a time, same server-side cancel as a single booking (carnet
  // session restored, teacher mailed); stop at the first refusal.
  let cancelled = 0;
  let error = null;
  for (const b of upcoming) {
    try {
      await apbApiFetch('/api/admin-bookings.php', { method: 'POST', body: JSON.stringify({ action: 'cancel', bookingId: b.id }) });
      cancelled++;
    } catch (e) {
      error = e;
      break;
    }
  }
  await syncAdminDataFromApi();
  renderBookingList();
  if (document.getElementById('student-modal')) showStudentProfile(email);
  if (error) {
    showAlert('bookings-alert', `${cancelled} réservation(s) annulée(s) sur ${upcoming.length}. ${adminApiErrorMessage(error)}`, 'error');
  } else {
    showAlert('bookings-alert', `✓ ${cancelled} réservation(s) annulée(s).`);
  }
}

// Passe par /api/admin-clients.php, qui met à jour la fiche, les snapshots
// nom/téléphone des réservations (ce que lisent les écrans admin) et, si
// l'email change, l'identifiant de connexion Supabase Auth.
//
// Avant, cette fonction réécrivait les tableaux bookings/carnets dans
// localStorage et son propre commentaire reconnaissait ne pas toucher au
// compte : la correction tenait jusqu'à la prochaine synchro, sur ce
// navigateur seulement.
async function saveClientEdit(oldEmail) {
  const first = document.getElementById('ce-firstname').value.trim();
  const last  = document.getElementById('ce-lastname').value.trim();
  const email = document.getElementById('ce-email').value.trim().toLowerCase();
  const phone = document.getElementById('ce-phone').value.trim();
  const alertEl = document.getElementById('ce-alert');

  if (!first || !last || !email) {
    alertEl.innerHTML = '<div class="alert alert-error">Prénom, nom et email sont obligatoires.</div>';
    return;
  }

  // L'email est aussi l'identifiant de connexion de l'élève : on ne le change
  // pas sans le dire.
  if (email !== (oldEmail || '').toLowerCase() &&
      !confirm(`Remplacer l'email de ${oldEmail} par ${email} ?\n\nC'est aussi son identifiant de connexion : l'élève devra se connecter avec la nouvelle adresse.`)) {
    return;
  }

  try {
    await apbApiFetch('/api/admin-clients.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'update', currentEmail: oldEmail, firstName: first, lastName: last, email, phone }),
    });
    await syncAdminDataFromApi();
  } catch (e) {
    alertEl.innerHTML = `<div class="alert alert-error">${escapeHtml(adminApiErrorMessage(e))}</div>`;
    return;
  }

  document.getElementById('student-modal').remove();
  showStudentProfile(email);
  apbRerenderCurrentPage();
  showAlert('bookings-alert', '✓ Coordonnées client mises à jour.');
}

function adminPrintInvoiceBooking(bookingId) {
  const b = getBookings().find(x => x.id === bookingId);
  if (!b) return;
  const date = new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'});
  const num  = 'FAC-' + bookingId;
  const w = window.open('','_blank');
  if (!w) { alert('Autorisez les pop-ups pour imprimer la facture.'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Facture ${num}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
    <style>body{font-family:'DM Sans',sans-serif;max-width:680px;margin:40px auto;padding:0 24px;color:#373737;font-size:14px}
    .logo{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:300;letter-spacing:.06em}
    table{width:100%;border-collapse:collapse}th{text-align:left;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#aaa;padding:8px 12px;border-bottom:2px solid #eee}
    td{padding:10px 12px;border-bottom:1px solid #eee;font-size:13px}.total{background:#373737;color:#fff;padding:14px 12px;display:flex;justify-content:space-between;font-weight:500}
    @media print{button{display:none}}<\/style><\/head><body>
    <div style="display:flex;justify-content:space-between;margin-bottom:32px">
      <div><div class="logo">Assas Pilates Ballet</div><div style="font-size:12px;color:#888;margin-top:4px;line-height:1.8">12, rue Duguay-Trouin — 75006 Paris<br>contact@assas-pilates-ballet.com</div></div>
      <div style="text-align:right"><div style="font-size:22px;font-family:'Cormorant Garamond',serif;font-weight:300">Facture ${num}</div><div style="font-size:12px;color:#888">Émise le ${date}</div></div>
    </div>
    <div style="background:#faf7f2;padding:14px 18px;margin-bottom:28px;border-left:3px solid #93bdb0;font-size:13px;line-height:1.8">
      <strong>${escapeHtml(b.clientFirstName)} ${escapeHtml(b.clientLastName)}</strong><br>${escapeHtml(b.clientEmail)}${b.clientPhone?'<br>'+escapeHtml(b.clientPhone):''}
    </div>
    <table><thead><tr><th>Cours</th><th>Date</th><th style="text-align:right">Montant</th></tr></thead>
    <tbody><tr>
      <td>${escapeHtml((b.slotTitle||'').replace('Cours ',''))}<br><span style="font-size:11px;color:#aaa">Prof. ${escapeHtml(b.slotTeacher||'—')}</span></td>
      <td>${new Date(b.courseDate+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})} ${b.slotStart}–${b.slotEnd}</td>
      <td style="text-align:right">${b.totalPaid > 0 ? b.totalPaid+'€' : 'Carnet'}</td>
    </tr></tbody></table>
    <div class="total"><span>${b.paymentType==='carnet'?'Carnet '+escapeHtml(b.carnetCode):'Carte bancaire'}</span><span>${b.totalPaid > 0 ? b.totalPaid+'€ TTC' : '—'}</span></div>
    <div style="margin-top:32px;font-size:11px;color:#bbb;text-align:center;border-top:1px solid #eee;padding-top:12px">Assas Pilates Ballet — TVA non applicable, art. 293 B du CGI</div>
    <button onclick="window.print()" style="margin-top:20px;padding:10px 24px;background:#373737;color:#fff;border:none;cursor:pointer;display:block;margin-left:auto">Imprimer / PDF</button>
  <\/body><\/html>`);
  w.document.close();
}

// ===== UNE SÉANCE DU PLANNING (clic sur un cours) =====
// Le planning affichait les inscrits en texte : pour annuler ou déplacer
// quelqu'un, il fallait retrouver sa réservation dans l'onglet Réservations.
// Un clic sur le cours ouvre maintenant la liste de ses inscrits, avec les
// mêmes actions que la liste des réservations -- et de quoi inscrire un
// élève payant sur place directement sur ce cours et cette date.
function apbCloseOccurrenceModal() {
  const m = document.getElementById('occurrence-modal');
  if (m) m.remove();
}

function openOccurrenceModal(slotId, dateISO) {
  const slot = apbBookableSlots().find(s => s.id === slotId) || getSlots().find(s => s.id === slotId);
  if (!slot) return;

  const enrolled = getBookings().filter(b =>
    b.slotId === slotId && b.courseDate === dateISO && (b.status === 'confirmed' || b.status === 'pending')
  );
  const total = enrolled.reduce((n, b) => n + (b.participants || 1), 0);

  const payLabel = { carnet: 'Carnet', onsite: 'Payé sur place', stripe: 'Payé en ligne' };
  const rows = enrolled.map(b => `
    <div style="border-top:1px solid var(--border);padding:12px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
      <div style="min-width:0">
        <div style="font-weight:500;cursor:pointer;color:var(--accent)" onclick="apbCloseOccurrenceModal();showStudentProfile('${escapeJsAttr(b.clientEmail || '')}')">
          ${escapeHtml(b.clientFirstName || '')} ${escapeHtml(b.clientLastName || '')}${(b.participants || 1) > 1 ? ` (${b.participants} pers.)` : ''}
        </div>
        <div style="font-size:11px;color:#888;margin-top:2px">
          ${escapeHtml(b.clientPhone || b.clientEmail || '')}
          · ${escapeHtml(payLabel[b.paymentType] || b.paymentType || '')}
          ${b.status === 'pending' ? ' · <span style="color:#b07a00">en attente d\'un 2e élève</span>' : ''}
        </div>
        ${b.clientMessage ? `<div style="font-size:11px;color:#888;margin-top:4px;font-style:italic">« ${escapeHtml(b.clientMessage)} »</div>` : ''}
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn btn-sm btn-outline" onclick="apbCloseOccurrenceModal();editBooking('${escapeJsAttr(b.id)}')">Déplacer</button>
        <button class="btn btn-sm btn-danger" onclick="apbOccurrenceCancel('${escapeJsAttr(b.id)}',${slotId},'${escapeJsAttr(dateISO)}')">Annuler</button>
      </div>
    </div>`).join('');

  const dateLabel = new Date(dateISO + 'T12:00:00')
    .toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  apbCloseOccurrenceModal();
  const modal = document.createElement('div');
  modal.id = 'occurrence-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow-y:auto';
  modal.innerHTML = `
    <div style="background:#fff;max-width:540px;width:100%;max-height:90vh;overflow-y:auto">
      <div style="background:#373737;color:#fff;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:1">
        <div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300">${escapeHtml(slot.title)}</div>
          <div style="font-size:12px;color:rgba(255,255,255,.65);margin-top:2px">${escapeHtml(dateLabel)} · ${escapeHtml(slot.start)}–${escapeHtml(slot.end)} · ${escapeHtml(slot.teacher || '')}</div>
        </div>
        <button onclick="apbCloseOccurrenceModal()" style="background:none;border:none;color:#fff;font-size:24px;cursor:pointer;line-height:1">×</button>
      </div>
      <div style="padding:24px">
        <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#aaa;margin-bottom:4px">
          Inscrits — ${total} / ${slot.capacity}
        </div>
        ${rows || '<div style="padding:16px 0;color:#bbb;font-style:italic">Aucune réservation sur cette séance.</div>'}
        <div class="form-actions" style="margin-top:20px">
          <button class="btn btn-outline" onclick="apbCloseOccurrenceModal()">Fermer</button>
          <button class="btn btn-primary" onclick="apbCloseOccurrenceModal();openNewBookingModal(${slotId},'${escapeJsAttr(dateISO)}')">Inscrire un élève</button>
        </div>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) apbCloseOccurrenceModal(); });
  document.body.appendChild(modal);
}

// Annule puis rouvre la séance : on enchaîne souvent plusieurs annulations
// sur le même cours, et repartir du planning à chaque fois est pénible.
async function apbOccurrenceCancel(bookingId, slotId, dateISO) {
  apbCloseOccurrenceModal();
  await adminCancelBooking(bookingId);
  openOccurrenceModal(slotId, dateISO);
}

// ===== PLANNING =====
function renderPlanningAdmin() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatDateISO(today);

  // Week start = this Monday + offset
  const weekStart = new Date(today);
  const dow = today.getDay(); // 0=Sun … 6=Sat
  const diffToMon = (dow === 0 ? -6 : 1 - dow); // days to most recent Monday
  weekStart.setDate(today.getDate() + diffToMon + calWeekOffset * 7);

  const days = Array.from({length: 7}, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
  });

  const slots    = getSlots();
  const bookings = getBookings();

  const MIN_H = 8, MAX_H = 20, ROW_H = 48;
  const totalRows   = (MAX_H - MIN_H) * 2;
  const gridHeight  = totalRows * ROW_H;
  const colTemplate = '60px repeat(7, minmax(110px, 1fr))';

  const fmt = d => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const weekLabel = `${fmt(days[0])} — ${fmt(days[6])}`;

  // ---- header row ----
  const headerCols = days.map(d => {
    const ds = formatDateISO(d);
    const cls = ds === todayStr ? ' today' : ds < todayStr ? ' past' : '';
    return `<div class="cal-header-day${cls}">
      <div class="cal-header-day-name">${d.toLocaleDateString('fr-FR',{weekday:'short'})}</div>
      <div class="cal-header-day-num">${d.getDate()}</div>
      <div class="cal-header-day-month">${d.toLocaleDateString('fr-FR',{month:'short'})}</div>
    </div>`;
  }).join('');

  // ---- time axis ----
  const timeAxis = Array.from({length: totalRows}, (_, i) => {
    const h = MIN_H + Math.floor(i / 2), m = i % 2 === 0 ? '00' : '30';
    return `<div class="cal-time-cell" style="height:${ROW_H}px">${m === '00' ? h + ':00' : ''}</div>`;
  }).join('');

  // ---- day columns ----
  const dayCols = days.map(d => {
    const ds  = formatDateISO(d);
    const appDay = (d.getDay() + 6) % 7;
    const daySlots = slots.filter(s => s.day === appDay);
    const isPast   = ds < todayStr;

    const lines = Array.from({length: totalRows}, (_, i) =>
      `<div class="cal-h-line${i % 2 === 0 ? ' hour' : ''}" style="top:${i * ROW_H}px"></div>`
    ).join('');

    // Two courses can run at the same hour in different rooms (Thursday 10:00
    // is both a Munz Floor and a Semi Collectif). These boxes are absolutely
    // positioned and full width, so without lanes the later one covers the
    // other outright -- bookings and all. Give each overlapping run its own
    // share of the column, the way a calendar app does.
    const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const items = daySlots
      .map(slot => ({ slot, from: toMin(slot.start), to: toMin(slot.end) }))
      .sort((a, b) => a.from - b.from || a.to - b.to);

    let clusterId = -1, clusterEnd = -Infinity, laneEnds = [];
    items.forEach(it => {
      if (it.from >= clusterEnd) { clusterId++; laneEnds = []; }
      let lane = laneEnds.findIndex(end => end <= it.from);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = it.to;
      it.lane = lane;
      it.cluster = clusterId;
      clusterEnd = Math.max(clusterEnd, it.to);
    });
    const lanesPerCluster = {};
    items.forEach(it => {
      lanesPerCluster[it.cluster] = Math.max(lanesPerCluster[it.cluster] || 0, it.lane + 1);
    });

    const events = items.map(({ slot, lane, cluster }) => {
      const [sh, sm] = slot.start.split(':').map(Number);
      const [eh, em] = slot.end.split(':').map(Number);
      const top    = ((sh * 60 + sm) - MIN_H * 60) / 30 * ROW_H;
      const height = Math.max(((eh * 60 + em) - (sh * 60 + sm)) / 30 * ROW_H - 2, 22);
      const lanes  = lanesPerCluster[cluster];
      // Only override the stylesheet's full-width left/right when sharing.
      const across = lanes > 1
        ? `left:calc(${(lane * 100) / lanes}% + 3px);width:calc(${100 / lanes}% - 6px);right:auto;`
        : '';

      const enrolled = bookings.filter(b =>
        b.slotId === slot.id && b.courseDate === ds && (b.status === 'confirmed' || b.status === 'pending')
      );
      const typeClass = enrolled.length ? `cal-event-${slot.type}` : 'cal-event-empty';
      const shortTitle = slot.title.replace(/^Cours\s+/,'').split('–')[0].trim();
      const names = enrolled.map(b => `${escapeHtml(b.clientFirstName)} ${escapeHtml((b.clientLastName||'').charAt(0))}.${b.status==='pending'?' ⏳':''}`).join(', ');
      const tooltip = `${slot.title} — ${enrolled.map(b => b.clientFirstName+' '+b.clientLastName+(b.status==='pending'?' (en attente)':'')).join(', ')||'Aucune réservation'}`;

      return `<div class="cal-event ${typeClass}" style="top:${top}px;height:${height}px;${across}cursor:pointer" title="${escapeHtml(tooltip)}" onclick="openOccurrenceModal(${slot.id},'${ds}')">
        <div class="cal-event-time">${slot.start}–${slot.end}</div>
        <div class="cal-event-title">${shortTitle}</div>
        ${enrolled.length ? `<div class="cal-event-students">${names}</div>` : ''}
        ${enrolled.length ? `<div class="cal-event-count">${enrolled.length}</div>` : ''}
      </div>`;
    }).join('');

    return `<div class="cal-day-col${isPast ? ' past-day' : ''}" style="height:${gridHeight}px">${lines}${events}</div>`;
  }).join('');

  document.getElementById('planning-content').innerHTML = `
    <div class="cal-nav">
      <button class="btn btn-outline btn-sm" onclick="calWeekOffset--; renderPlanningAdmin()">← Préc.</button>
      <span class="cal-nav-title">${weekLabel}</span>
      <button class="btn btn-outline btn-sm" onclick="calWeekOffset++; renderPlanningAdmin()">Suiv. →</button>
    </div>
    <div class="cal-wrap">
      <div class="cal-header" style="display:grid;grid-template-columns:${colTemplate}">
        <div class="cal-header-time"></div>${headerCols}
      </div>
      <div class="cal-body" style="display:grid;grid-template-columns:${colTemplate};overflow-y:auto;max-height:680px">
        <div class="cal-time-col">${timeAxis}</div>${dayCols}
      </div>
    </div>`;
}

// ===== CLIENTS =====
let _allClients = [];

function renderClientsAdmin() {
  const today = formatDateISO(new Date());
  const bookings = getBookings();
  const carnets  = getCarnets();
  const map = {};

  bookings.forEach(b => {
    const e = (b.clientEmail || '').toLowerCase();
    if (!e) return;
    if (!map[e]) map[e] = { email:e, name:'—', phone:'', bookings:[], carnets:[] };
    const n = getClientName(b);
    if (n !== '—') map[e].name = n;
    if (b.clientPhone) map[e].phone = b.clientPhone;
    map[e].bookings.push(b);
  });
  carnets.forEach(c => {
    const e = (c.clientEmail || '').toLowerCase();
    if (!e) return;
    if (!map[e]) map[e] = { email:e, name:'—', phone:'', bookings:[], carnets:[] };
    const n = getClientName(c);
    if (n !== '—') map[e].name = n;
    if (c.clientPhone) map[e].phone = c.clientPhone;
    map[e].carnets.push(c);
  });

  _allClients = Object.values(map).sort((a, b) => {
    const la = [...a.bookings].sort((x,y) => y.courseDate.localeCompare(x.courseDate))[0]?.courseDate || '';
    const lb = [...b.bookings].sort((x,y) => y.courseDate.localeCompare(x.courseDate))[0]?.courseDate || '';
    return lb.localeCompare(la);
  });

  const badge = document.getElementById('clients-count');
  if (badge) badge.textContent = `${_allClients.length} client(s)`;
  filterClients();
}

function filterClients() {
  const q = (document.getElementById('clients-search')?.value || '').toLowerCase();
  const today = formatDateISO(new Date());
  const list = q ? _allClients.filter(c => c.name.toLowerCase().includes(q) || c.email.includes(q)) : _allClients;

  document.getElementById('clients-tbody').innerHTML = list.length
    ? list.map(client => {
        const upcoming = client.bookings.filter(b => b.status === 'confirmed' && b.courseDate >= today).length;
        const past     = client.bookings.filter(b => b.courseDate < today && b.status === 'confirmed').length;
        const activeC  = client.carnets.find(c => c.active && c.remainingSessions > 0);
        const last     = [...client.bookings].sort((a,b) => b.courseDate.localeCompare(a.courseDate))[0];
        return `<tr style="cursor:pointer" onclick="showStudentProfile('${escapeJsAttr(client.email)}')">
          <td>
            <div style="font-size:13px;font-weight:500;color:var(--accent)">${escapeHtml(client.name)}</div>
            <div style="font-size:11px;color:#aaa">${escapeHtml(client.email)}</div>
          </td>
          <td style="font-size:12px;color:#888">${escapeHtml(client.phone || '—')}</td>
          <td style="text-align:center">
            <strong>${upcoming}</strong>${past ? `<span style="font-size:10px;color:#aaa"> +${past} passés</span>` : ''}
          </td>
          <td style="text-align:center">
            ${activeC
              ? `<span style="color:#2E6B30;font-size:12px;font-weight:500">${activeC.remainingSessions} séance(s)</span>`
              : `<span style="color:#ddd;font-size:12px">—</span>`}
          </td>
          <td style="font-size:12px;color:#888">${last ? new Date(last.courseDate+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}) : '—'}</td>
          <td class="actions" onclick="event.stopPropagation()">
            <button class="btn btn-sm btn-outline" onclick="showStudentProfile('${escapeJsAttr(client.email)}')">Détails</button>
          </td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="6" style="text-align:center;color:#bbb;padding:24px;font-style:italic">${q ? 'Aucun résultat.' : 'Aucun client enregistré.'}</td></tr>`;
}

// ===== INIT =====
// ===== AUTH GATE =====
// Client-side check: hides the whole admin UI unless the browser holds a valid
// Supabase session AND that user's id is in the `staff` table. This is real
// authentication (not the old "no check at all"), but it is NOT the final
// enforcement layer -- that's site/api/_lib/auth.php's apbRequireAdmin(),
// checked server-side on every write once the PHP API is deployed. Until then,
// a determined attacker who can run arbitrary JS in this page could still call
// admin functions directly in devtools; what this gate closes is the far more
// realistic threat of "anyone who finds/guesses this URL sees all client data."
async function checkAdminAuthAndInit() {
  const staff = await isCurrentUserStaff();
  if (!staff) {
    document.getElementById('admin-login-screen').style.display = 'flex';
    document.getElementById('admin-layout').style.display = 'none';
    return;
  }
  document.getElementById('admin-login-screen').style.display = 'none';
  document.getElementById('admin-layout').style.display = '';
  const stripeNav = document.getElementById('nav-booking-config');
  if (stripeNav) stripeNav.style.display = getStaffFlags().can_view_stripe_config === false ? 'none' : '';
  await syncContentFromSupabase();
  const gotRealData = await syncAdminDataFromApi();
  renderDashboard();
  if (!gotRealData) {
    alert("Impossible de charger les réservations et les carnets depuis le serveur. Ce qui s'affiche date peut-être de votre dernière visite : rechargez la page dans un instant.");
  }
}

async function adminLogin() {
  const email    = document.getElementById('al-email').value.trim();
  const password = document.getElementById('al-password').value;
  const alertEl  = document.getElementById('al-alert');
  alertEl.innerHTML = '';
  if (!email || !password) {
    alertEl.innerHTML = '<div class="alert alert-error">Email et mot de passe requis.</div>';
    return;
  }
  try {
    await supabaseSignIn(email, password);
  } catch (e) {
    alertEl.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
    return;
  }
  const staff = await isCurrentUserStaff();
  if (!staff) {
    alertEl.innerHTML = '<div class="alert alert-error">Ce compte n\'a pas les droits administrateur.</div>';
    await supabaseSignOut();
    return;
  }
  checkAdminAuthAndInit();
}

async function adminLogout() {
  await supabaseSignOut();
  location.reload();
}

document.addEventListener('DOMContentLoaded', () => {
  checkAdminAuthAndInit();
});
