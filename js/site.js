/**
 * Assas Pilates Ballet — Site vitrine JS
 */

// ===== NAVIGATION =====
function showPage(page) {
  document.querySelectorAll('.site-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  const section = document.getElementById('page-' + page);
  if (section) section.classList.add('active');
  const link = document.getElementById('nav-' + page);
  if (link) link.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  return false;
}

// ===== RENDER SCHEDULE =====
function renderSchedule(containerId, mini = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const slots = getSlots();

  let html = '';
  DAYS.forEach((day, di) => {
    const daySlots = slots.filter(s => s.day === di).sort((a, b) => a.start.localeCompare(b.start));
    html += `<div class="day-col">
      <div class="day-header">${mini ? DAYS_SHORT[di] : day}</div>
      <div class="day-slots">`;
    if (!daySlots.length) {
      html += `<div class="no-class">—</div>`;
    } else {
      const shown = mini ? daySlots.slice(0, 3) : daySlots;
      shown.forEach(s => {
        const loc = LOCATIONS[s.location || 'assas'] || LOCATIONS.assas;
        const locBadge = !mini && s.location === 'lieu2'
          ? `<div class="slot-loc" style="font-size:10px;color:#D4845A;margin-top:2px">📍 ${loc.short}</div>`
          : '';
        html += `<div class="slot ${s.type}">
          <div class="slot-time">${s.start}${mini ? '' : ' – ' + s.end}</div>
          <div class="slot-title">${mini ? s.title.replace('Cours ', '').split('–')[0].trim() : s.title}</div>
          ${!mini ? `<div class="slot-teacher">👤 ${s.teacher}</div>${locBadge}` : ''}
        </div>`;
      });
      if (mini && daySlots.length > 3) {
        html += `<div style="font-size:9px;color:#999;padding:4px 6px">+${daySlots.length - 3} autres</div>`;
      }
    }
    html += `</div></div>`;
  });

  container.innerHTML = html;

  const upd = document.getElementById('schedule-updated');
  if (upd) {
    const now = new Date();
    upd.textContent = `Dernière mise à jour : ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'})}`;
  }
}

// ===== RENDER TEAM =====
function renderTeam() {
  const container = document.getElementById('team-grid');
  if (!container) return;
  const team = getTeam().sort((a, b) => (a.order || 0) - (b.order || 0));

  container.innerHTML = team.map(m => {
    const tags = (m.tags || '').split(',').filter(Boolean);
    const initials = m.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const photoInner = m.photo
      ? `<img src="${m.photo}" alt="${m.name}">`
      : `<span class="team-photo-initials">${initials}</span>`;
    return `<div class="team-card">
      <div class="team-photo">${photoInner}</div>
      <div class="team-role">${m.role}</div>
      <div class="team-name">${m.name}</div>
      <div class="team-bio">${m.bio}</div>
      <div class="team-tags">${tags.map(t => `<span class="team-tag">${t.trim()}</span>`).join('')}</div>
    </div>`;
  }).join('');
}

// ===== RENDER TARIFS =====
function renderTarifs() {
  const container = document.getElementById('tarifs-grid');
  if (!container) return;
  const tarifs = getTarifs();

  const tarif_card = t => {
    const extraClass = t.type === 'munz' ? ' tarif-card-munz' : (t.type === 'decouverte' ? ' tarif-card-decouverte' : '');
    const cta = t.isCarnet
      ? `<a href="booking/buy-carnet.html" class="tarif-cta tarif-cta-carnet">Acheter ce carnet →</a>`
      : `<a href="booking/index.html" class="tarif-cta">Réserver →</a>`;
    return `<div class="tarif-card ${t.featured ? 'featured' : ''}${extraClass}">
      ${t.featured ? '<div class="tarif-badge">Recommandé</div>' : ''}
      ${t.isCarnet ? '<div class="tarif-carnet-tag">Carnet</div>' : ''}
      <div class="tarif-label">${t.label}</div>
      <div class="tarif-name">${t.name}</div>
      <div class="tarif-sessions">${t.sessions}</div>
      <div class="tarif-price"><span class="tarif-currency">€</span>${t.price}</div>
      <div class="tarif-note">${t.note}</div>
      ${cta}
    </div>`;
  };

  const groups = [
    { key: 'collectif',  label: 'Semi-Collectif Mat' },
    { key: 'duo',        label: 'Cours Duo Wall Unit' },
    { key: 'prive',      label: 'Cours Privé Mat + Machine' },
    { key: 'munz',       label: 'Munz Floor®' },
    { key: 'decouverte', label: 'Formule découverte' },
  ];

  const grouped = new Set();
  let html = groups.map(g => {
    const items = tarifs.filter(t => t.type === g.key);
    if (!items.length) return '';
    items.forEach(t => grouped.add(t.id));
    return `<div class="tarif-group tarif-group-${g.key}">
      <div class="tarif-group-label">${g.label}</div>
      <div class="tarif-group-grid">${items.map(tarif_card).join('')}</div>
    </div>`;
  }).join('');

  const ungrouped = tarifs.filter(t => !grouped.has(t.id));
  if (ungrouped.length) {
    html += `<div class="tarif-group-grid">${ungrouped.map(tarif_card).join('')}</div>`;
  }

  container.innerHTML = html;
}

// ===== RENDER INFOS =====
function renderInfos() {
  const infos = getInfos();
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const setLink = (id, href) => { const el = document.getElementById(id); if (el) el.href = href; };

  set('info-addr1', infos.addr1 || DEFAULT_INFOS.addr1);
  const telEl = document.getElementById('info-tel-link');
  if (telEl) { telEl.textContent = infos.tel || DEFAULT_INFOS.tel; telEl.href = 'tel:' + (infos.tel || '').replace(/\s/g, ''); }
  const emailEl = document.getElementById('info-email-link');
  if (emailEl) { emailEl.textContent = infos.email || DEFAULT_INFOS.email; emailEl.href = 'mailto:' + (infos.email || DEFAULT_INFOS.email); }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  renderSchedule('schedule-grid');
  renderSchedule('home-schedule-grid', true);
  renderTeam();
  renderTarifs();
  renderInfos();
});
