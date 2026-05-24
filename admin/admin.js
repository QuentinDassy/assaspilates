/**
 * Assas Pilates Ballet — Admin JS
 */

let selectedDay    = 0;
let calWeekOffset  = 0;

// Helper: display name from carnet or booking (handles both naming conventions)
function getClientName(obj) {
  if (obj.clientName) return obj.clientName;
  return [obj.clientFirstName, obj.clientLastName].filter(Boolean).join(' ').trim() || '—';
}

// ===== NAVIGATION =====
function showPage(pageId) {
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
let slotNextId;

function renderScheduleAdmin() {
  const slots = getSlots();
  slotNextId = Math.max(0, ...slots.map(s => s.id)) + 1;
  renderDayPills();
  renderSlotsTable();
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

function saveSlot() {
  const id  = document.getElementById('slot-id').value;
  const slot = {
    id:       id ? parseInt(id) : slotNextId++,
    day:      selectedDay,
    start:    document.getElementById('slot-start').value,
    end:      document.getElementById('slot-end').value,
    title:    document.getElementById('slot-title').value.trim(),
    type:     document.getElementById('slot-type').value,
    location: document.getElementById('slot-location').value,
    teacher:  document.getElementById('slot-teacher').value.trim(),
  };
  if (!slot.title) { showAlert('schedule-alert', 'Veuillez renseigner le titre du cours.', 'error'); return; }

  let slots = getSlots();
  if (id) slots = slots.map(s => s.id === slot.id ? slot : s);
  else slots.push(slot);
  saveSlots(slots);
  resetSlotForm();
  renderSlotsTable();
  renderMiniSchedule('dash-schedule');
  showAlert('schedule-alert', '✓ Créneau enregistré. Visible instantanément sur le site.');
}

function editSlot(id) {
  const slot = getSlots().find(s => s.id === id);
  if (!slot) return;
  document.getElementById('slot-id').value      = slot.id;
  selectedDay = slot.day;
  document.getElementById('slot-start').value   = slot.start;
  document.getElementById('slot-end').value      = slot.end;
  document.getElementById('slot-title').value   = slot.title;
  document.getElementById('slot-type').value    = slot.type;
  document.getElementById('slot-location').value = slot.location || 'assas';
  document.getElementById('slot-teacher').value = slot.teacher;
  document.getElementById('slot-form-title').textContent = 'Modifier le créneau';
  renderDayPills();
  document.getElementById('slot-start').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function deleteSlot(id) {
  if (!confirm('Supprimer ce créneau ?')) return;
  saveSlots(getSlots().filter(s => s.id !== id));
  renderSlotsTable();
  showAlert('schedule-alert', 'Créneau supprimé.');
}

function resetSlotForm() {
  document.getElementById('slot-id').value      = '';
  document.getElementById('slot-start').value   = '09:00';
  document.getElementById('slot-end').value     = '09:55';
  document.getElementById('slot-title').value   = '';
  document.getElementById('slot-type').value    = 'collectif';
  document.getElementById('slot-location').value = 'assas';
  document.getElementById('slot-teacher').value = '';
  document.getElementById('slot-form-title').textContent = 'Nouveau créneau';
  selectedDay = 0;
  renderDayPills();
}

// ===== TEAM =====
let teamNextId;

function renderTeamAdmin() {
  const team = getTeam();
  teamNextId = Math.max(0, ...team.map(t => t.id)) + 1;
  const sorted = [...team].sort((a, b) => (a.order || 0) - (b.order || 0));
  document.getElementById('team-tbody').innerHTML = sorted.map(m => `
    <tr>
      <td><strong>${m.name}</strong></td>
      <td style="font-size:12px;color:#888">${m.role}</td>
      <td>${m.order + 1}</td>
      <td class="actions">
        <button class="btn btn-sm btn-outline" onclick="editMember(${m.id})">Modifier</button>
        <button class="btn btn-sm btn-danger" onclick="deleteMember(${m.id})">✕</button>
      </td>
    </tr>
  `).join('');
}

function saveMember() {
  const id = document.getElementById('member-id').value;
  const m = {
    id:    id ? parseInt(id) : teamNextId++,
    name:  document.getElementById('member-name').value.trim(),
    email: document.getElementById('member-email').value.trim(),
    role:  document.getElementById('member-role').value.trim(),
    bio:   document.getElementById('member-bio').value.trim(),
    tags:  document.getElementById('member-tags').value.trim(),
    order: parseInt(document.getElementById('member-order').value) || 0,
  };
  if (!m.name) { showAlert('team-alert', 'Le nom est obligatoire.', 'error'); return; }
  let team = getTeam();
  if (id) team = team.map(t => t.id === m.id ? m : t);
  else team.push(m);
  saveTeam(team);
  resetMemberForm();
  renderTeamAdmin();
  showAlert('team-alert', '✓ Membre enregistré. Visible instantanément sur le site.');
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

function deleteMember(id) {
  if (!confirm('Supprimer ce membre ?')) return;
  saveTeam(getTeam().filter(t => t.id !== id));
  renderTeamAdmin();
  showAlert('team-alert', 'Membre supprimé.');
}

function resetMemberForm() {
  ['member-id','member-name','member-email','member-role','member-bio','member-tags'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('member-order').value = '0';
  document.getElementById('team-form-title').textContent = 'Nouveau membre';
}

// ===== TARIFS =====
let tarifNextId;

function renderTarifsAdmin() {
  const tarifs = getTarifs();
  tarifNextId = Math.max(0, ...tarifs.map(t => t.id)) + 1;
  document.getElementById('tarifs-tbody').innerHTML = tarifs.map(t => `
    <tr>
      <td>
        <strong>${t.name}</strong>${t.isCarnet ? ' <span style="font-size:10px;background:#e8f5e9;color:#2E6B30;padding:2px 6px">Carnet</span>' : ''}<br>
        <span style="font-size:11px;color:#999">${t.label}</span>
      </td>
      <td style="font-size:12px">${t.sessions}</td>
      <td style="font-weight:500;color:#93bdb0">${t.price}€</td>
      <td>${t.featured ? '<span class="badge badge-featured">✓ Oui</span>' : '—'}</td>
      <td class="actions">
        <button class="btn btn-sm btn-outline" onclick="editTarif(${t.id})">Modifier</button>
        <button class="btn btn-sm btn-danger" onclick="deleteTarif(${t.id})">✕</button>
      </td>
    </tr>
  `).join('');
}

function saveTarifForm() {
  const id = document.getElementById('tarif-id').value;
  const sessionCount = parseInt(document.getElementById('tarif-session-count').value) || 0;
  const validityMonths = parseInt(document.getElementById('tarif-validity').value) || 0;
  const isCarnet = document.getElementById('tarif-is-carnet').checked;
  const t = {
    id:       id ? parseInt(id) : tarifNextId++,
    name:     document.getElementById('tarif-name').value.trim(),
    label:    document.getElementById('tarif-label').value.trim(),
    sessions: document.getElementById('tarif-sessions').value.trim(),
    price:    document.getElementById('tarif-price').value,
    note:     document.getElementById('tarif-note').value.trim(),
    featured: document.getElementById('tarif-featured').checked,
    isCarnet,
    sessionCount:   isCarnet ? sessionCount : 0,
    validityMonths: isCarnet ? validityMonths : 0,
  };
  if (!t.name) { showAlert('tarifs-alert', 'Le nom est obligatoire.', 'error'); return; }
  let tarifs = getTarifs();
  if (id) tarifs = tarifs.map(x => x.id === t.id ? t : x);
  else tarifs.push(t);
  saveTarifs(tarifs);
  resetTarifForm();
  renderTarifsAdmin();
  showAlert('tarifs-alert', '✓ Formule enregistrée. Visible instantanément sur le site.');
}

function editTarif(id) {
  const t = getTarifs().find(x => x.id === id);
  if (!t) return;
  document.getElementById('tarif-id').value            = t.id;
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

function deleteTarif(id) {
  if (!confirm('Supprimer cette formule ?')) return;
  saveTarifs(getTarifs().filter(t => t.id !== id));
  renderTarifsAdmin();
  showAlert('tarifs-alert', 'Formule supprimée.');
}

function resetTarifForm() {
  ['tarif-id','tarif-name','tarif-label','tarif-sessions','tarif-price','tarif-note','tarif-session-count','tarif-validity'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
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

function saveInfosForm() {
  const get = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  const infos = {
    addr1:       get('info-addr1'),
    addr2:       get('info-addr2'),
    tel:         get('info-tel'),
    email:       get('info-email'),
    instagram:   get('info-instagram'),
    cancelHours: parseInt(get('info-cancel')) || 24,
    retardMin:   parseInt(get('info-retard')) || 10,
    ponctMsg:    get('info-ponct'),
  };
  saveInfos(infos);
  showAlert('infos-alert', '✓ Informations enregistrées. Visibles sur le site.');
}

// ===== STRIPE CONFIG =====
function renderBookingConfig() {
  const config = JSON.parse(localStorage.getItem('apb_stripe') || '{}');
  const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  set('stripe-mode',   config.mode);
  set('stripe-pk',     config.pk);
  set('stripe-sk',     config.sk);
  set('stripe-ws',     config.ws);
  set('stripe-cancel', config.cancel || 24);
}

function saveStripeConfig() {
  const config = {
    mode:   document.getElementById('stripe-mode').value,
    pk:     document.getElementById('stripe-pk').value,
    sk:     document.getElementById('stripe-sk').value,
    ws:     document.getElementById('stripe-ws').value,
    cancel: document.getElementById('stripe-cancel').value,
  };
  localStorage.setItem('apb_stripe', JSON.stringify(config));
  showAlert('schedule-alert', '✓ Configuration Stripe enregistrée.');
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
        <div style="font-size:13px;cursor:pointer;color:var(--accent)" onclick="showStudentProfile('${b.clientEmail}')">${b.clientFirstName} ${b.clientLastName}</div>
        <div style="font-size:11px;color:#aaa">${b.clientEmail}</div>
      </td>
      <td style="font-size:12px;max-width:160px">${(b.slotTitle||'').replace('Cours ','')}</td>
      <td style="font-size:12px;white-space:nowrap">${new Date(b.courseDate+'T12:00:00').toLocaleDateString('fr-FR')} ${b.slotStart}</td>
      <td style="font-size:11px;color:#888">${loc}</td>
      <td>
        ${b.paymentType === 'carnet'
          ? `<span style="font-size:11px;color:#2E6B30">Carnet</span>`
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

function adminCancelBooking(id) {
  const b = getBookings().find(x => x.id === id);
  if (!b) return;
  const isStripe   = b.paymentType === 'stripe';
  const carnetNote = b.paymentType === 'carnet' ? '\nLa séance sera restituée sur le carnet.' : '';
  const refundNote = isStripe ? `\n💳 Un remboursement de ${b.totalPaid || 0}€ devra être effectué au client.` : '';
  if (!confirm(`Annuler la réservation ${id} ?\nClient : ${b.clientFirstName} ${b.clientLastName}${carnetNote}${refundNote}`)) return;
  cancelBooking(id);
  renderBookingList();
  const msg = isStripe
    ? `✓ Réservation annulée. Pensez à rembourser <strong>${b.totalPaid || 0}€</strong> au client.`
    : `✓ Réservation ${id} annulée.${b.paymentType === 'carnet' ? ' Séance restituée.' : ''}`;
  showAlert('bookings-alert', msg);
}

function nextDateForDay(dayOfWeek, fromDateStr) {
  const jsDay = (dayOfWeek + 1) % 7;
  const base  = fromDateStr ? new Date(fromDateStr + 'T12:00:00') : new Date();
  base.setHours(0, 0, 0, 0);
  if (base.getDay() === jsDay) return fromDateStr;
  let diff = jsDay - base.getDay();
  if (diff <= 0) diff += 7;
  const d = new Date(base);
  d.setDate(base.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function onEditDayChange(day) {
  document.querySelectorAll('#eb-day-pills .day-pill').forEach(btn =>
    btn.classList.toggle('active', parseInt(btn.dataset.day) === day)
  );
  const isCustom = day < 0;
  document.getElementById('eb-course-group').style.display  = isCustom ? 'none' : '';
  document.getElementById('eb-custom-fields').style.display = isCustom ? 'block' : 'none';
  document.getElementById('eb-date-warn').innerHTML = '';
  if (!isCustom) {
    const slots = getSlots().filter(s => s.day === day).sort((a,b) => a.start.localeCompare(b.start));
    document.getElementById('eb-slot').innerHTML = slots.map(s =>
      `<option value="${s.id}">${s.start}–${s.end} — ${s.title.replace('Cours ','')}</option>`
    ).join('');
    document.getElementById('eb-date').value = nextDateForDay(day, document.getElementById('eb-date').value);
  }
}

function onEditDateChange() {
  if (document.getElementById('eb-course-group').style.display === 'none') return;
  const slot = getSlots().find(s => s.id === parseInt(document.getElementById('eb-slot').value));
  if (!slot) return;
  const date = document.getElementById('eb-date').value;
  if (!date) return;
  const jsDay  = (slot.day + 1) % 7;
  const selDay = new Date(date + 'T12:00:00').getDay();
  const warnEl = document.getElementById('eb-date-warn');
  if (selDay !== jsDay) {
    const names = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    warnEl.innerHTML = `<span style="color:#c0392b;font-size:11px">⚠ Ce cours a lieu le ${DAYS[slot.day]} (date choisie : ${names[selDay]}).
      <button onclick="document.getElementById('eb-date').value=nextDateForDay(${slot.day},document.getElementById('eb-date').value);document.getElementById('eb-date-warn').innerHTML=''"
        style="background:none;border:none;cursor:pointer;color:var(--accent);font-size:11px;text-decoration:underline;font-family:inherit;padding:0;margin-left:4px">Corriger →</button></span>`;
  } else {
    warnEl.innerHTML = '';
  }
}

function editBooking(id) {
  const b = getBookings().find(x => x.id === id);
  if (!b) return;
  const slots    = getSlots();
  const allDays  = [...new Set(slots.map(s => s.day))].sort((a,b) => a - b);
  const curSlot  = slots.find(s => s.id === b.slotId);
  const isCustom = !curSlot;
  const initDay  = isCustom ? -1 : curSlot.day;

  let modal = document.getElementById('edit-booking-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'edit-booking-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow-y:auto';
    document.body.appendChild(modal);
  }

  const dayPills = allDays.map(d =>
    `<button type="button" class="day-pill${d === initDay ? ' active' : ''}" data-day="${d}" onclick="onEditDayChange(${d})">${DAYS[d]}</button>`
  ).join('') + `<button type="button" class="day-pill${isCustom ? ' active' : ''}" data-day="-1" onclick="onEditDayChange(-1)">Personnalisé</button>`;

  const daySlots = isCustom ? [] : slots.filter(s => s.day === initDay).sort((a,b) => a.start.localeCompare(b.start));
  const slotOptions = daySlots.map(s =>
    `<option value="${s.id}"${s.id === b.slotId ? ' selected' : ''}>${s.start}–${s.end} — ${s.title.replace('Cours ','')}</option>`
  ).join('');

  modal.innerHTML = `
    <div style="background:#fff;max-width:540px;width:100%;position:relative;max-height:90vh;overflow-y:auto">
      <div style="background:#373737;color:#fff;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:1">
        <div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300">Modifier la réservation</div>
        <button onclick="document.getElementById('edit-booking-modal').remove()" style="background:none;border:none;color:#fff;font-size:24px;cursor:pointer;line-height:1">×</button>
      </div>
      <div style="padding:24px">
        <div style="font-size:10px;color:#aaa;letter-spacing:.1em;text-transform:uppercase;margin-bottom:20px">${id}</div>

        <div class="form-group">
          <label>Jour</label>
          <div class="day-pills" id="eb-day-pills" style="flex-wrap:wrap">${dayPills}</div>
        </div>

        <div class="form-group" id="eb-course-group" style="${isCustom ? 'display:none' : ''}">
          <label>Cours</label>
          <select id="eb-slot">${slotOptions}</select>
        </div>

        <div id="eb-custom-fields" style="display:${isCustom ? 'block' : 'none'};background:#faf9f6;border:1px solid var(--border);padding:14px 16px;margin-bottom:2px">
          <div class="form-group" style="margin-bottom:10px">
            <label>Intitulé</label>
            <input type="text" id="eb-custom-title" value="${isCustom ? (b.slotTitle || '') : ''}" placeholder="Ex. Cours Privé Mat">
          </div>
          <div class="form-row">
            <div class="form-group"><label>Début</label><input type="time" id="eb-custom-start" value="${isCustom ? (b.slotStart || '') : ''}"></div>
            <div class="form-group"><label>Fin</label><input type="time" id="eb-custom-end" value="${isCustom ? (b.slotEnd || '') : ''}"></div>
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label>Professeur</label>
            <input type="text" id="eb-custom-teacher" value="${isCustom ? (b.slotTeacher || '') : ''}">
          </div>
        </div>

        <div class="form-group">
          <label>Date du cours</label>
          <input type="date" id="eb-date" value="${b.courseDate}" onchange="onEditDateChange()">
          <div id="eb-date-warn" style="margin-top:4px"></div>
        </div>

        <div style="background:#faf9f6;border:1px solid var(--border);padding:12px 16px;margin-bottom:16px;font-size:13px">
          <div style="font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#aaa;margin-bottom:6px">Client — modifiable depuis la fiche client</div>
          <div style="font-weight:500">${b.clientFirstName || ''} ${b.clientLastName || ''}</div>
          <div style="color:#888;font-size:12px;margin-top:2px">${b.clientEmail || ''}${b.clientPhone ? ' · ' + b.clientPhone : ''}</div>
        </div>

        <div id="eb-alert"></div>
        <div class="form-actions">
          <button class="btn btn-outline" onclick="document.getElementById('edit-booking-modal').remove()">Annuler</button>
          <button class="btn btn-primary" onclick="saveBookingEdit('${id}')">Enregistrer</button>
        </div>
      </div>
    </div>`;

  modal.style.display = 'flex';
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function saveBookingEdit(id) {
  const isCustom = document.getElementById('eb-course-group').style.display === 'none';
  const date     = document.getElementById('eb-date').value;
  if (!date) { document.getElementById('eb-alert').innerHTML = '<div class="alert alert-error">La date est obligatoire.</div>'; return; }

  let bookings = getBookings();
  const idx = bookings.findIndex(b => b.id === id);
  if (idx === -1) return;

  if (isCustom) {
    const title = document.getElementById('eb-custom-title').value.trim();
    if (!title) { document.getElementById('eb-alert').innerHTML = '<div class="alert alert-error">L\'intitulé est obligatoire.</div>'; return; }
    bookings[idx].slotId      = null;
    bookings[idx].slotTitle   = title;
    bookings[idx].slotStart   = document.getElementById('eb-custom-start').value;
    bookings[idx].slotEnd     = document.getElementById('eb-custom-end').value;
    bookings[idx].slotTeacher = document.getElementById('eb-custom-teacher').value.trim();
    bookings[idx].slotDay     = null;
  } else {
    const slot = getSlots().find(s => s.id === parseInt(document.getElementById('eb-slot').value));
    if (slot) {
      bookings[idx].slotId = slot.id; bookings[idx].slotTitle = slot.title;
      bookings[idx].slotDay = slot.day; bookings[idx].slotStart = slot.start;
      bookings[idx].slotEnd = slot.end; bookings[idx].slotTeacher = slot.teacher;
    }
  }
  bookings[idx].courseDate = date;

  saveBookings(bookings);
  document.getElementById('edit-booking-modal').remove();
  renderBookingList();
  showAlert('bookings-alert', `✓ Réservation ${id} modifiée.`);
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
  ].map(v => `"${String(v).replace(/"/g,'""')}"`));

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
      carnetTarifs.map(t => `<option value="${t.id}" data-sessions="${t.sessionCount}" data-months="${t.validityMonths}" data-name="${t.name}">${t.name} (${t.sessionCount} séances — ${t.price}€)</option>`).join('');
  }

  // Sort: active first, then by creation desc
  const sorted = [...carnets].sort((a,b) => {
    if (a.active !== b.active) return b.active ? 1 : -1;
    return (b.createdAt || b.purchasedAt || '').localeCompare(a.createdAt || a.purchasedAt || '');
  });

  const now = new Date();
  const carnetRow = c => {
    const expired  = c.expiresAt && new Date(c.expiresAt) < now;
    const depleted = c.remainingSessions <= 0;
    const statusColor = (!c.active || expired || depleted) ? '#c0392b' : '#2E6B30';
    const statusLabel = !c.active ? 'Désactivé' : expired ? 'Expiré' : depleted ? 'Épuisé' : 'Actif';
    return `<tr>
      <td style="font-family:monospace;font-size:12px;letter-spacing:.06em">${c.code}</td>
      <td>
        <div style="font-size:13px;cursor:pointer;color:var(--accent)" onclick="showStudentProfile('${c.clientEmail}')">${getClientName(c)}</div>
        <div style="font-size:11px;color:#aaa">${c.clientEmail}</div>
      </td>
      <td><strong>${c.remainingSessions}</strong> / ${c.totalSessions}<div style="font-size:10px;color:#aaa">${c.tarifName}</div></td>
      <td style="font-size:12px">${c.expiresAt || '—'}</td>
      <td><span style="font-size:11px;font-weight:500;color:${statusColor}">${statusLabel}</span></td>
      <td class="actions">
        <button class="btn btn-sm btn-outline" onclick="editCarnet('${c.code}')">Modifier</button>
        ${c.active ? `<button class="btn btn-sm btn-danger" onclick="deactivateCarnet('${c.code}')">Désact.</button>` : ''}
      </td>
    </tr>`;
  };
  const activeC   = sorted.filter(c => c.active && c.remainingSessions > 0 && (!c.expiresAt || new Date(c.expiresAt) >= now));
  const inactiveC = sorted.filter(c => !c.active || c.remainingSessions <= 0 || (c.expiresAt && new Date(c.expiresAt) < now));
  const sepRow = label => `<tr><td colspan="6" style="background:var(--dark);color:rgba(255,255,255,.5);font-size:9px;letter-spacing:.2em;text-transform:uppercase;padding:5px 14px">${label}</td></tr>`;
  let rows = '';
  if (activeC.length)   rows += sepRow(`Actifs — ${activeC.length}`) + activeC.map(carnetRow).join('');
  if (inactiveC.length) rows += sepRow(`Épuisés / Expirés — ${inactiveC.length}`) + inactiveC.map(carnetRow).join('');
  document.getElementById('carnets-tbody').innerHTML = rows || '<tr><td colspan="6" style="text-align:center;color:#bbb;padding:24px;font-style:italic">Aucun carnet créé.</td></tr>';
}

function updateCarnetFormFromTarif() {
  const sel = document.getElementById('carnet-tarif-id');
  const opt = sel.options[sel.selectedIndex];
  if (!opt.value) return;
  const sessions = parseInt(opt.dataset.sessions) || 0;
  const months   = parseInt(opt.dataset.months)   || 0;
  document.getElementById('carnet-sessions').value   = sessions;
  document.getElementById('carnet-remaining').value  = sessions;
  if (months) {
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + months);
    document.getElementById('carnet-expires').value = expiry.toISOString().split('T')[0];
  }
}

function saveCarnet() {
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

  let carnets = getCarnets();

  if (editCode) {
    const idx = carnets.findIndex(c => c.code === editCode);
    if (idx !== -1) {
      carnets[idx].clientName       = name;
      carnets[idx].clientEmail      = email;
      carnets[idx].totalSessions    = total;
      carnets[idx].remainingSessions = remain;
      carnets[idx].expiresAt        = expires || null;
      carnets[idx].active           = remain > 0;
      carnets[idx].clientName = name;
      saveCarnets(carnets);
      showAlert('carnets-alert', `✓ Carnet ${editCode} mis à jour.`);
      resetCarnetForm();
      renderCarnetsAdmin();
      return;
    }
  }

  const code = generateCarnetCode();
  const carnet = {
    code,
    tarifId:           tarifOpt.value || null,
    tarifName:         tarifOpt.value ? tarifOpt.dataset.name : 'Manuel',
    clientName:        name,
    clientEmail:       email,
    totalSessions:     total,
    remainingSessions: remain,
    expiresAt:         expires || null,
    active:            true,
    createdAt:         new Date().toISOString().split('T')[0],
    bookingIds:        [],
  };
  carnets.push(carnet);
  saveCarnets(carnets);

  lastGeneratedCode = code;
  document.getElementById('generated-code').textContent = code;
  document.getElementById('generated-code-block').style.display = 'block';
  showAlert('carnets-alert', `✓ Carnet créé. Transmettez le code au client.`);
  renderCarnetsAdmin();
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
  document.getElementById('carnet-form-title').textContent = `Modifier — ${c.code}`;
  document.getElementById('carnet-save-btn').textContent   = 'Enregistrer les modifications';
  document.getElementById('generated-code-block').style.display = 'none';
  document.getElementById('carnet-form-title').scrollIntoView({behavior:'smooth', block:'nearest'});
}

function deactivateCarnet(code) {
  if (!confirm(`Désactiver le carnet ${code} ?`)) return;
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
          ? `<button class="btn btn-sm btn-danger" onclick="adminCancelBooking('${b.id}');showStudentProfile('${email}')">Annuler</button>`
          : ''}
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="5" style="color:#bbb;padding:12px;font-style:italic">Aucune réservation</td></tr>`;

  const carnetRows = carnets.map(c => {
    const expired  = c.expiresAt && new Date(c.expiresAt) < new Date();
    const sc = (!c.active || expired || c.remainingSessions <= 0) ? '#c0392b' : '#2E6B30';
    const sl = !c.active ? 'Désactivé' : expired ? 'Expiré' : c.remainingSessions <= 0 ? 'Épuisé' : 'Actif';
    return `<tr>
      <td style="font-family:monospace;font-size:12px">${c.code}</td>
      <td>${c.tarifName || '—'}</td>
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
          <div style="font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:300">${name.trim() || email}</div>
          <div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:4px">${email} · ${phone}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
          <button onclick="document.getElementById('client-edit-zone').style.display=document.getElementById('client-edit-zone').style.display==='none'?'block':'none'"
            style="background:none;border:1px solid rgba(255,255,255,.3);color:rgba(255,255,255,.8);font-size:10px;letter-spacing:.1em;text-transform:uppercase;padding:6px 14px;cursor:pointer;font-family:inherit">Modifier</button>
          <button onclick="document.getElementById('student-modal').remove()" style="background:none;border:none;color:#fff;font-size:24px;cursor:pointer;line-height:1;padding:0">×</button>
        </div>
      </div>
      <div id="client-edit-zone" style="display:none;padding:20px 24px;border-bottom:1px solid var(--border);background:#faf9f6">
        <div class="form-row">
          <div class="form-group"><label>Prénom</label><input type="text" id="ce-firstname" value="${firstName}"></div>
          <div class="form-group"><label>Nom</label><input type="text" id="ce-lastname" value="${lastName}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Téléphone</label><input type="tel" id="ce-phone" value="${phone !== '—' ? phone : ''}"></div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="ce-email" value="${email}">
            <small>Changer l'email modifie l'identifiant de connexion</small>
          </div>
        </div>
        <div id="ce-alert"></div>
        <div class="form-actions" style="margin-top:4px">
          <button class="btn btn-primary" onclick="saveClientEdit('${email}')">Enregistrer</button>
          <button class="btn btn-outline" onclick="document.getElementById('client-edit-zone').style.display='none'">Annuler</button>
        </div>
      </div>
      <div style="padding:20px 24px;overflow-x:auto">
        ${upcoming.length ? `<div style="margin-bottom:12px">
          <button class="btn btn-danger" onclick="adminCancelStudent('${email}')" style="font-size:11px">
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

function adminCancelStudent(email) {
  const upcoming = getBookings().filter(b =>
    b.clientEmail && b.clientEmail.toLowerCase() === email.toLowerCase() &&
    b.status === 'confirmed' && new Date(b.courseDate+'T23:59:00') >= new Date()
  );
  if (!upcoming.length) return;
  if (!confirm(`Annuler les ${upcoming.length} réservation(s) à venir de cet élève ?`)) return;
  upcoming.forEach(b => cancelBooking(b.id));
  showStudentProfile(email);
  showAlert('bookings-alert', `✓ ${upcoming.length} réservation(s) annulée(s).`);
}

function saveClientEdit(oldEmail) {
  const first = document.getElementById('ce-firstname').value.trim();
  const last  = document.getElementById('ce-lastname').value.trim();
  const email = document.getElementById('ce-email').value.trim().toLowerCase();
  const phone = document.getElementById('ce-phone').value.trim();
  const alertEl = document.getElementById('ce-alert');

  if (!first || !last || !email) {
    alertEl.innerHTML = '<div class="alert alert-error">Prénom, nom et email sont obligatoires.</div>';
    return;
  }

  const oldLower = oldEmail.toLowerCase();

  let bookings = getBookings();
  bookings = bookings.map(b => {
    if ((b.clientEmail || '').toLowerCase() !== oldLower) return b;
    return { ...b, clientFirstName: first, clientLastName: last, clientEmail: email, clientPhone: phone };
  });
  saveBookings(bookings);

  let carnets = getCarnets();
  carnets = carnets.map(c => {
    if ((c.clientEmail || '').toLowerCase() !== oldLower) return c;
    return { ...c, clientFirstName: first, clientLastName: last, clientName: `${first} ${last}`, clientEmail: email, clientPhone: phone };
  });
  saveCarnets(carnets);

  if (email !== oldLower) {
    const pwds = getPasswords();
    if (pwds[oldLower]) { pwds[email] = pwds[oldLower]; delete pwds[oldLower]; savePasswords(pwds); }
  }

  document.getElementById('student-modal').remove();
  showStudentProfile(email);
  const activePage = document.querySelector('.page.active');
  if (activePage && activePage.id === 'page-clients') renderClientsAdmin();
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
      <strong>${b.clientFirstName} ${b.clientLastName}</strong><br>${b.clientEmail}${b.clientPhone?'<br>'+b.clientPhone:''}
    </div>
    <table><thead><tr><th>Cours</th><th>Date</th><th style="text-align:right">Montant</th></tr></thead>
    <tbody><tr>
      <td>${(b.slotTitle||'').replace('Cours ','')}<br><span style="font-size:11px;color:#aaa">Prof. ${b.slotTeacher||'—'}</span></td>
      <td>${new Date(b.courseDate+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})} ${b.slotStart}–${b.slotEnd}</td>
      <td style="text-align:right">${b.totalPaid > 0 ? b.totalPaid+'€' : 'Carnet'}</td>
    </tr></tbody></table>
    <div class="total"><span>${b.paymentType==='carnet'?'Carnet '+b.carnetCode:'Carte bancaire'}</span><span>${b.totalPaid > 0 ? b.totalPaid+'€ TTC' : '—'}</span></div>
    <div style="margin-top:32px;font-size:11px;color:#bbb;text-align:center;border-top:1px solid #eee;padding-top:12px">Assas Pilates Ballet — TVA non applicable, art. 293 B du CGI</div>
    <button onclick="window.print()" style="margin-top:20px;padding:10px 24px;background:#373737;color:#fff;border:none;cursor:pointer;display:block;margin-left:auto">Imprimer / PDF</button>
  <\/body><\/html>`);
  w.document.close();
}

// ===== PLANNING =====
function renderPlanningAdmin() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

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
    const ds = d.toISOString().split('T')[0];
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
    const ds  = d.toISOString().split('T')[0];
    const appDay = (d.getDay() + 6) % 7;
    const daySlots = slots.filter(s => s.day === appDay);
    const isPast   = ds < todayStr;

    const lines = Array.from({length: totalRows}, (_, i) =>
      `<div class="cal-h-line${i % 2 === 0 ? ' hour' : ''}" style="top:${i * ROW_H}px"></div>`
    ).join('');

    const events = daySlots.map(slot => {
      const [sh, sm] = slot.start.split(':').map(Number);
      const [eh, em] = slot.end.split(':').map(Number);
      const top    = ((sh * 60 + sm) - MIN_H * 60) / 30 * ROW_H;
      const height = Math.max(((eh * 60 + em) - (sh * 60 + sm)) / 30 * ROW_H - 2, 22);

      const enrolled = bookings.filter(b =>
        b.slotId === slot.id && b.courseDate === ds && (b.status === 'confirmed' || b.status === 'pending')
      );
      const typeClass = enrolled.length ? `cal-event-${slot.type}` : 'cal-event-empty';
      const shortTitle = slot.title.replace(/^Cours\s+/,'').split('–')[0].trim();
      const names = enrolled.map(b => `${b.clientFirstName} ${(b.clientLastName||'').charAt(0)}.${b.status==='pending'?' ⏳':''}`).join(', ');
      const tooltip = `${slot.title} — ${enrolled.map(b => b.clientFirstName+' '+b.clientLastName+(b.status==='pending'?' (en attente)':'')).join(', ')||'Aucune réservation'}`;

      return `<div class="cal-event ${typeClass}" style="top:${top}px;height:${height}px" title="${tooltip}">
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
  const today = new Date().toISOString().split('T')[0];
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
  const today = new Date().toISOString().split('T')[0];
  const list = q ? _allClients.filter(c => c.name.toLowerCase().includes(q) || c.email.includes(q)) : _allClients;

  document.getElementById('clients-tbody').innerHTML = list.length
    ? list.map(client => {
        const upcoming = client.bookings.filter(b => b.status === 'confirmed' && b.courseDate >= today).length;
        const past     = client.bookings.filter(b => b.courseDate < today && b.status === 'confirmed').length;
        const activeC  = client.carnets.find(c => c.active && c.remainingSessions > 0);
        const last     = [...client.bookings].sort((a,b) => b.courseDate.localeCompare(a.courseDate))[0];
        return `<tr style="cursor:pointer" onclick="showStudentProfile('${client.email}')">
          <td>
            <div style="font-size:13px;font-weight:500;color:var(--accent)">${client.name}</div>
            <div style="font-size:11px;color:#aaa">${client.email}</div>
          </td>
          <td style="font-size:12px;color:#888">${client.phone || '—'}</td>
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
            <button class="btn btn-sm btn-outline" onclick="showStudentProfile('${client.email}')">Détails</button>
          </td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="6" style="text-align:center;color:#bbb;padding:24px;font-style:italic">${q ? 'Aucun résultat.' : 'Aucun client enregistré.'}</td></tr>`;
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  seedDemoData(); // idempotent — seeds demo if empty, fills gaps on subsequent opens
  renderDashboard();
});
