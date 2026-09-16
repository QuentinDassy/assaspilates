/**
 * Assas Pilates Ballet — Données partagées
 * Ce fichier est la source de vérité pour le site et l'admin.
 * Les données sont sauvegardées dans localStorage.
 */

const DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const DAYS_SHORT = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

const LOCATIONS = {
  assas: { name: 'Studio Assas', short: 'Assas', addr: '12, rue Duguay-Trouin — 75006 Paris', color: '#6BB5A8' },
  lieu2: { name: 'Studio Munz Floor', short: 'Munz Floor', addr: '30, rue Monsieur Le Prince — 75006 Paris', color: '#D68FA0' },
};

const DEFAULT_SLOTS = [
  {id:1, day:0,start:'09:00',end:'09:55',title:'Cours Semi Collectif Mat – DÉBUTANT',type:'collectif',teacher:'Leïla Dilhac',location:'assas'},
  {id:2, day:0,start:'10:00',end:'10:55',title:'Cours Privé Mat + Machine',type:'prive',teacher:'Leïla Dilhac',location:'assas'},
  {id:3, day:0,start:'11:00',end:'11:55',title:'Cours Privé Mat + Machine',type:'prive',teacher:'Leïla Dilhac',location:'assas'},
  {id:4, day:0,start:'12:00',end:'12:55',title:'Cours Semi Collectif Mat – INTERMÉDIAIRE',type:'collectif',teacher:'Leïla Dilhac',location:'assas'},
  {id:5, day:0,start:'14:00',end:'14:55',title:'Cours Privé Mat + Machine',type:'prive',teacher:'Leïla Dilhac',location:'assas'},
  {id:6, day:0,start:'15:00',end:'15:55',title:'Cours Privé Mat + Machine',type:'prive',teacher:'Leïla Dilhac',location:'assas'},
  {id:7, day:1,start:'09:00',end:'09:55',title:'Cours Duo Wall unit',type:'duo',teacher:'Leïla Dilhac',location:'assas'},
  {id:8, day:1,start:'10:00',end:'10:55',title:'Cours Semi Collectif Mat – INTERMÉDIAIRE',type:'collectif',teacher:'Leïla Dilhac',location:'assas'},
  {id:9, day:1,start:'11:00',end:'11:55',title:'Cours Privé Mat + Machine',type:'prive',teacher:'Leïla Dilhac',location:'assas'},
  {id:10,day:1,start:'12:00',end:'12:55',title:'Cours Semi Collectif Mat – DÉBUTANT',type:'collectif',teacher:'Leïla Dilhac',location:'assas'},
  {id:11,day:1,start:'14:00',end:'14:55',title:'Cours Privé Mat + Machine',type:'prive',teacher:'Leïla Dilhac',location:'assas'},
  {id:12,day:1,start:'15:00',end:'15:55',title:'Cours Privé Mat + Machine',type:'prive',teacher:'Leïla Dilhac',location:'assas'},
  {id:13,day:2,start:'09:30',end:'10:25',title:'Cours Semi Collectif Mat – INTERMÉDIAIRE',type:'collectif',teacher:'Leïla Dilhac',location:'assas'},
  {id:14,day:2,start:'10:30',end:'11:25',title:'Cours Privé Mat + Machine',type:'prive',teacher:'Leïla Dilhac',location:'assas'},
  {id:15,day:2,start:'18:00',end:'18:55',title:'Cours Semi Collectif Mat – DÉBUTANT',type:'collectif',teacher:'Marie Lacoste',location:'assas'},
  {id:16,day:2,start:'19:00',end:'19:55',title:'Cours Semi Collectif Mat – INTERMÉDIAIRE',type:'collectif',teacher:'Marie Lacoste',location:'assas'},
  {id:17,day:3,start:'09:00',end:'09:55',title:'Cours Privé Mat + Machine',type:'prive',teacher:'Leïla Dilhac',location:'assas'},
  {id:18,day:3,start:'10:00',end:'10:55',title:'Cours Semi Collectif Mat – INTERMÉDIAIRE',type:'collectif',teacher:'Leïla Dilhac',location:'assas'},
  {id:19,day:3,start:'11:00',end:'11:55',title:'Cours Privé Mat + Machine',type:'prive',teacher:'Leïla Dilhac',location:'assas'},
  {id:20,day:3,start:'12:00',end:'12:55',title:'Cours Semi Collectif Mat – DÉBUTANT',type:'collectif',teacher:'Leïla Dilhac',location:'assas'},
  {id:21,day:3,start:'14:00',end:'14:55',title:'Cours Privé Mat + Machine',type:'prive',teacher:'Leïla Dilhac',location:'assas'},
  {id:22,day:3,start:'15:00',end:'15:55',title:'Cours Privé Mat + Machine',type:'prive',teacher:'Leïla Dilhac',location:'assas'},
  {id:23,day:4,start:'09:00',end:'09:55',title:'Cours Semi Collectif Mat – INTERMÉDIAIRE',type:'collectif',teacher:'Leïla Dilhac',location:'assas'},
  {id:24,day:4,start:'10:00',end:'10:55',title:'Cours Privé Mat + Machine',type:'prive',teacher:'Leïla Dilhac',location:'assas'},
  {id:25,day:4,start:'11:00',end:'11:55',title:'Cours Semi Collectif Mat – DÉBUTANT',type:'collectif',teacher:'Leïla Dilhac',location:'assas'},
  {id:26,day:4,start:'13:00',end:'13:55',title:'Cours Duo Wall unit',type:'duo',teacher:'Leïla Dilhac',location:'assas'},
  {id:27,day:4,start:'14:00',end:'14:55',title:'Cours Privé Mat + Machine',type:'prive',teacher:'Leïla Dilhac',location:'assas'},
  {id:28,day:4,start:'15:00',end:'15:55',title:'Cours Privé Mat + Machine',type:'prive',teacher:'Leïla Dilhac',location:'assas'},
  {id:29,day:5,start:'10:30',end:'11:25',title:'Cours Privé Mat + Machine',type:'prive',teacher:'Leïla Dilhac',location:'assas'},
  // ---- Studio Munz Floor ----
  {id:30,day:1,start:'10:00',end:'10:55',title:'Cours Munz Floor — Niveau 1',type:'munz',teacher:'Leïla Dilhac',location:'lieu2'},
  {id:31,day:1,start:'11:00',end:'11:55',title:'Cours Munz Floor — Niveau 2',type:'munz',teacher:'Leïla Dilhac',location:'lieu2'},
  {id:32,day:3,start:'10:00',end:'10:55',title:'Cours Munz Floor — Niveau 1',type:'munz',teacher:'Leïla Dilhac',location:'lieu2'},
  {id:33,day:3,start:'11:00',end:'11:55',title:'Cours Munz Floor — Niveau 2',type:'munz',teacher:'Leïla Dilhac',location:'lieu2'},
  {id:34,day:5,start:'09:30',end:'10:25',title:'Cours Munz Floor — Niveau 1',type:'munz',teacher:'Marie Lacoste',location:'lieu2'},
];

const DEFAULT_TEAM = [
  {id:1,name:'Leïla Dilhac',email:'',role:'Fondatrice · Danseuse Opéra de Paris',bio:'Fondatrice du studio, Leïla a été danseuse à l\'Opéra de Paris pendant vingt-cinq ans, une expérience qui a profondément façonné son regard sur le mouvement, la précision du geste et l\'intelligence du corps.<br><br>Diplômée d\'État de professeur de danse classique, elle a toujours eu à cœur de transmettre son expertise tout en explorant de nouvelles approches du mouvement. Certifiée en Pilates et en Munz Floor®, elle est également la créatrice de la Barre Aquatique, une méthode originale développée à partir de son expérience de la danse et de son intérêt pour le travail corporel en profondeur.',tags:'Pilates classique,MUNZ FLOOR®,Diplôme d\'État danse',order:0,photo:'images/team-leila.jpg'},
  {id:2,name:'Marie Lacoste',email:'',role:'Instructrice Pilates',bio:'Danseuse de formation et diplômée d\'État en danse classique, Marie transmet depuis de nombreuses années sa passion du mouvement avec exigence, précision et bienveillance.<br><br>Formée au Pilates chez A-Lyne dès 2008, elle s\'est spécialisée dans l\'accompagnement du corps à travers une approche fondée sur l\'alignement, la fluidité et la conscience du mouvement. Son expérience de la danse nourrit profondément son enseignement, lui permettant d\'observer avec finesse chaque élève et d\'adapter les exercices à ses besoins.<br><br>Ses cours allient rigueur, technique et plaisir du mouvement, dans une recherche constante d\'équilibre, de force et d\'harmonie corporelle.',tags:'Pilates,Barre au sol,Danse classique',order:1,photo:'images/team-marie.jpg'},
  {id:3,name:'Emily Regent',email:'',role:'Instructrice Pilates & Chorégraphe',bio:'Son parcours s\'est enrichi au fil des années par des formations en art-thérapie, en Gyrotonic et Shiatsu, lui offrant une vision globale de la personne et du mouvement. Cette complémentarité d\'expertises lui permet d\'accompagner chaque élève avec finesse, en tenant compte de son histoire corporelle, de ses besoins et de ses objectifs.<br><br>Elle transmet un Pilates exigeant et accessible, guidé par la recherche d\'un mouvement plus libre, plus harmonieux et plus conscient.',tags:'Pilates POLESTAR,Gyrotonic,Shiatsu',order:2,photo:'images/team-emily.jpg'},
  {id:4,name:'William Moundi',email:'',role:'Masseur bien-être',bio:'Ancien danseur et chorégraphe, William met au service de ses clients une connaissance approfondie du corps acquise à travers son parcours artistique et plus de quinze années d\'expérience dans le domaine du bien-être.<br><br>Après avoir exercé au sein de l\'Institut Figari pendant de nombreuses années, il intervient aujourd\'hui auprès des artistes de l\'Opéra de Paris. Son approche associe écoute, précision et qualité de présence afin de répondre aux besoins spécifiques de chacun.',tags:'Massage Californien,Massage Suédois,Réflexologie',order:3,photo:'images/team-william.jpg'},
];

const DEFAULT_TARIFS = [
  // ---- Semi-Collectif Mat ----
  {id:1,  name:'Séance à l\'unité',  label:'Semi-Collectif Mat', sessions:'1 séance — Débutant / Intermédiaire', price:'35',   note:'',                      featured:false, isCarnet:false, type:'collectif'},
  {id:2,  name:'Carnet 5 séances',   label:'Semi-Collectif Mat', sessions:'5 séances — valable 3 mois',          price:'140',  note:'(soit 28 €/séance)',    featured:false, isCarnet:true,  sessionCount:5,  validityMonths:3,  type:'collectif'},
  {id:3,  name:'Carnet 10 séances',  label:'Semi-Collectif Mat', sessions:'10 séances — valable 6 mois',         price:'260',  note:'(soit 26 €/séance)',    featured:true,  isCarnet:true,  sessionCount:10, validityMonths:6,  type:'collectif'},
  {id:4,  name:'Carnet 20 séances',  label:'Semi-Collectif Mat', sessions:'20 séances — valable 12 mois',        price:'480',  note:'(soit 24 €/séance)',    featured:false, isCarnet:true,  sessionCount:20, validityMonths:12, type:'collectif'},
  // ---- Formule découverte ----
  {id:5,  name:'Formule découverte', label:'1 cours collectif + 1 cours privé', sessions:'2 séances',           price:'95',   note:'',                      featured:false, isCarnet:false, type:'decouverte'},
  // ---- Duo Wall Unit ----
  {id:6,  name:'Séance à l\'unité',  label:'Cours Duo Wall Unit', sessions:'1 séance duo',                      price:'50',   note:'',                      featured:false, isCarnet:false, type:'duo'},
  {id:7,  name:'Carnet 5 séances',   label:'Cours Duo Wall Unit', sessions:'5 séances — valable 3 mois',        price:'230',  note:'(soit 46 €/séance)',    featured:false, isCarnet:true,  sessionCount:5,  validityMonths:3,  type:'duo'},
  {id:8,  name:'Carnet 10 séances',  label:'Cours Duo Wall Unit', sessions:'10 séances — valable 6 mois',       price:'440',  note:'(soit 44 €/séance)',    featured:false, isCarnet:true,  sessionCount:10, validityMonths:6,  type:'duo'},
  {id:9,  name:'Carnet 20 séances',  label:'Cours Duo Wall Unit', sessions:'20 séances — valable 12 mois',      price:'840',  note:'(soit 42 €/séance)',    featured:false, isCarnet:true,  sessionCount:20, validityMonths:12, type:'duo'},
  // ---- Privé Mat + Machine ----
  {id:10, name:'Séance à l\'unité',  label:'Cours Privé Mat + Machine', sessions:'1 séance individuelle',       price:'90',   note:'',                      featured:false, isCarnet:false, type:'prive'},
  {id:11, name:'Carnet 5 séances',   label:'Cours Privé Mat + Machine', sessions:'5 séances — valable 3 mois',  price:'425',  note:'(soit 85 €/séance)',    featured:false, isCarnet:true,  sessionCount:5,  validityMonths:3,  type:'prive'},
  {id:12, name:'Carnet 10 séances',  label:'Cours Privé Mat + Machine', sessions:'10 séances — valable 6 mois', price:'800',  note:'(soit 80 €/séance)',    featured:false, isCarnet:true,  sessionCount:10, validityMonths:6,  type:'prive'},
  {id:13, name:'Carnet 20 séances',  label:'Cours Privé Mat + Machine', sessions:'20 séances — valable 12 mois',price:'1520', note:'(soit 76 €/séance)',    featured:false, isCarnet:true,  sessionCount:20, validityMonths:12, type:'prive'},
  // ---- Munz Floor ----
  {id:14, name:'Séance à l\'unité',  label:'Munz Floor', sessions:'1 séance',                      price:'30',  note:'',                     featured:false, isCarnet:false, type:'munz'},
  {id:15, name:'Carnet 10 séances',  label:'Munz Floor', sessions:'10 séances — valable 6 mois',   price:'280', note:'(soit 28 €/séance)',    featured:false, isCarnet:true,  sessionCount:10, validityMonths:6,  type:'munz'},
  {id:16, name:'Carnet 20 séances',  label:'Munz Floor', sessions:'20 séances — valable 12 mois',  price:'540', note:'(soit 27 €/séance)',    featured:false, isCarnet:true,  sessionCount:20, validityMonths:12, type:'munz'},
];

const DEFAULT_INFOS = {
  addr1: '12, rue Duguay-Trouin, Paris 75006',
  addr2: '30, rue Monsieur Le Prince, Paris 75006',
  tel: '07 45 19 24 61',
  email: 'contact@assas-pilates-ballet.com',
  instagram: '@assaspilatesballet',
  cancelHours: 24,
  retardMin: 10,
  ponctMsg: 'Au-delà de 10 minutes de retard, nous ne pourrons malheureusement pas vous accueillir en classe pour ne pas perturber le déroulement de la séance. Ce cours restera dû.',
};

const DEFAULT_CARNETS  = [];
const DEFAULT_BOOKINGS = [];
const DEFAULT_TEACHER_ABSENCES = [];

// ===== STORAGE =====
function getData(key, defaults) {
  try {
    const stored = localStorage.getItem('apb_' + key);
    return stored ? JSON.parse(stored) : JSON.parse(JSON.stringify(defaults));
  } catch(e) {
    return JSON.parse(JSON.stringify(defaults));
  }
}

function setData(key, value) {
  try { localStorage.setItem('apb_' + key, JSON.stringify(value)); } catch(e) {}
}

// ===== SUPABASE SYNC (Phase 1: reads only) =====
// Fetches the shared content tables and writes them into the same localStorage
// keys getData()/getSlots() etc. already read from -- every existing call site
// (40+ across site.js/admin.js/booking pages) keeps working synchronously and
// unchanged. This is called once per page load (see each page's DOMContentLoaded)
// before any render function runs. Admin *writes* still go to localStorage only
// until the PHP API (site/api/admin-*.php) is actually deployed and reachable --
// see the backend plan for the write-side of Phase 1.
async function syncContentFromSupabase() {
  try {
    const [slotsRows, teamRows, tarifsRows, infosRows, absencesRows] = await Promise.all([
      supabaseSelect('slots', '?active=eq.true&order=day_of_week.asc,start_time.asc'),
      supabaseSelect('team_members', '?order=sort_order.asc'),
      supabaseSelect('tarifs', '?active=eq.true&order=id.asc'),
      supabaseSelect('site_settings', '?id=eq.1'),
      supabaseSelect('teacher_absences', '?order=start_date.asc'),
    ]);

    saveSlots(slotsRows.map(r => ({
      id: r.id, day: r.day_of_week, start: r.start_time.slice(0, 5), end: r.end_time.slice(0, 5),
      title: r.title, type: r.type, teacher: r.teacher_name, teacherId: r.teacher_id, location: r.location_key,
      capacity: r.capacity, priceCents: r.price_cents,
    })));

    saveTeacherAbsences(absencesRows.map(r => ({
      id: r.id, teacherId: r.team_member_id, startDate: r.start_date, endDate: r.end_date,
      startTime: r.start_time ? r.start_time.slice(0, 5) : '', endTime: r.end_time ? r.end_time.slice(0, 5) : '',
      reason: r.reason || '',
    })));

    saveTeam(teamRows.map(r => ({
      id: r.id, name: r.name, email: r.email || '', role: r.role || '',
      bio: r.bio_html || '', tags: (r.tags || []).join(','), order: r.sort_order, photo: r.photo_path || '',
    })));

    saveTarifs(tarifsRows.map(r => ({
      id: r.id, name: r.name, label: r.label, sessions: r.sessions_display || '',
      price: String(r.price_cents / 100), note: r.note || '', featured: r.featured,
      isCarnet: r.is_carnet, sessionCount: r.session_count, validityMonths: r.validity_months, type: r.type,
    })));

    if (infosRows[0]) {
      const s = infosRows[0];
      saveInfos({
        addr1: s.addr1 || '', addr2: s.addr2 || '', tel: s.phone || '', email: s.email || '',
        instagram: s.instagram || '', cancelHours: s.cancel_hours, retardMin: s.late_minutes,
        ponctMsg: s.punctuality_message || '',
      });
    }
  } catch (e) {
    // Offline / Supabase unreachable: keep whatever is already in localStorage
    // (the DEFAULT_* seed on first visit, or last successfully synced data).
    console.warn('syncContentFromSupabase failed, using cached/local data:', e);
  }
}

// ===== SUPABASE SYNC (Phase 3: this client's own bookings/carnets) =====
// Maps the PHP API's snake_case rows (site/api/my-bookings.php) to the same
// shape saveBookings()/saveCarnets() already store, then merges them into
// the existing apb_bookings/apb_carnets localStorage keys (removing any
// stale local entries for this email first) -- every existing render
// function (renderDashboard, renderCarnets, etc. in manage.html and
// site.js) keeps working unchanged, same pattern as syncContentFromSupabase().
function apbMapApiBooking(b, email) {
  return {
    id: b.id, clientFirstName: b.client_first_name_snapshot, clientLastName: b.client_last_name_snapshot,
    clientEmail: email, clientPhone: b.client_phone_snapshot || '', clientMessage: b.client_message || '',
    slotId: b.slot_id, slotTitle: b.slot_title_snapshot,
    slotStart: (b.slot_start_snapshot || '').slice(0, 5), slotEnd: (b.slot_end_snapshot || '').slice(0, 5),
    teacher: b.slot_teacher_snapshot, slotTeacher: b.slot_teacher_snapshot, slotLocation: b.slot_location_snapshot,
    courseDate: b.course_date, participants: b.participants, paymentType: b.payment_type,
    carnetId: b.carnet_id, carnetCode: null, totalPaid: (b.total_paid_cents || 0) / 100,
    status: b.status, paymentStatus: b.payment_status, createdAt: b.created_at, cancelledAt: b.cancelled_at,
  };
}

function apbMapApiCarnet(c, email) {
  return {
    id: c.id, code: c.code, tarifId: c.tarif_id, tarifName: c.tarif_name_snapshot, type: c.type,
    totalSessions: c.total_sessions, remainingSessions: c.remaining_sessions, validityMonths: c.validity_months,
    expiresAt: c.expires_at, active: c.active, clientEmail: email,
    totalPaid: (c.total_paid_cents || 0) / 100, purchasedAt: c.purchased_at, status: c.status,
  };
}

// Returns true if the sync ran; false means the request failed -- callers
// keep working off whatever local data already exists rather than treating
// this as fatal.
async function syncMyBookingsFromApi(email) {
  try {
    const data = await apbApiFetch('/api/my-bookings.php');
    const lower = email.trim().toLowerCase();
    const mappedCarnets = data.carnets.map(c => apbMapApiCarnet(c, lower));
    const mappedBookings = data.bookings.map(b => {
      const mapped = apbMapApiBooking(b, lower);
      const carnet = mappedCarnets.find(c => c.id === mapped.carnetId);
      if (carnet) mapped.carnetCode = carnet.code;
      return mapped;
    });
    saveBookings(getBookings().filter(b => (b.clientEmail || '').toLowerCase() !== lower).concat(mappedBookings));
    saveCarnets(getCarnets().filter(c => (c.clientEmail || '').toLowerCase() !== lower).concat(mappedCarnets));
    if (data.client) {
      setData('my_profile', {
        email: data.client.email || lower,
        firstName: data.client.first_name || '',
        lastName: data.client.last_name || '',
        phone: data.client.phone || '',
      });
    }
    return true;
  } catch (e) {
    console.warn('syncMyBookingsFromApi failed:', e);
    return false;
  }
}

function getSlots()    { return getData('slots',    DEFAULT_SLOTS);    }
function getTeam()     { return getData('team',     DEFAULT_TEAM);     }
function getTarifs()   { return getData('tarifs',   DEFAULT_TARIFS);   }
function getInfos()    { return getData('infos',    DEFAULT_INFOS);    }
function getCarnets()  { return getData('carnets',  DEFAULT_CARNETS);  }
function getBookings() { return getData('bookings', DEFAULT_BOOKINGS); }
function getTeacherAbsences() { return getData('teacher_absences', DEFAULT_TEACHER_ABSENCES); }
/** Profile of the signed-in client, filled by syncMyBookingsFromApi(). */
function getMyProfile()       { return getData('my_profile', null); }

function saveSlots(d)    { setData('slots',    d); }
function saveTeam(d)     { setData('team',     d); }
function saveTarifs(d)   { setData('tarifs',   d); }
function saveInfos(d)    { setData('infos',    d); }
function saveCarnets(d)  { setData('carnets',  d); }
function saveBookings(d) { setData('bookings', d); }
function saveTeacherAbsences(d) { setData('teacher_absences', d); }

// True if this teacher has a "vacances" period covering dateISO (YYYY-MM-DD).
function isTeacherAbsentOn(teacherId, dateISO) {
  if (!teacherId) return false;
  return getTeacherAbsences().some(a => a.teacherId === teacherId && dateISO >= a.startDate && dateISO <= a.endDate);
}

// Like getNextOccurrence(), but skips forward week by week past any
// "vacances" period the slot's teacher has on that date -- the booking pages
// only ever offer this single next date per weekly slot (no multi-week date
// picker), so a slot doesn't just silently look unavailable for the whole
// length of a teacher's absence. Capped at 26 weeks out as a sane backstop.
function getNextAvailableOccurrence(slot) {
  let date = getNextOccurrence(slot.day);
  for (let i = 0; i < 26 && isTeacherAbsentOn(slot.teacherId, formatDateISO(date)); i++) {
    date = new Date(date);
    date.setDate(date.getDate() + 7);
  }
  return date;
}

// Plaintext-password-in-localStorage scheme removed -- real auth is
// site/js/auth.js (Supabase Auth: supabaseSignIn/supabaseSignUp/supabaseSignOut).

// ===== UTILITIES =====
// dayOfWeek: 0=Lundi … 6=Dimanche → renvoie la prochaine date (jamais aujourd'hui)
function getNextOccurrence(dayOfWeek) {
  const jsDay = (dayOfWeek + 1) % 7; // lundi(0)→1, dimanche(6)→0
  const today  = new Date();
  today.setHours(0,0,0,0);
  let diff = jsDay - today.getDay();
  if (diff <= 0) diff += 7;
  const d = new Date(today);
  d.setDate(today.getDate() + diff);
  return d;
}

// Monday (00:00) of the calendar week `offset` weeks from the current one
// (offset=0 -> the week containing today). Backs the booking page's
// navigable week view (site/booking/index.html).
function getWeekMonday(offset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const jsDay = today.getDay(); // 0=dimanche..6=samedi
  const mondayDelta = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayDelta + offset * 7);
  return monday;
}

// dayOfWeek: 0=Lundi…6=Dimanche -> the concrete date of that weekday in the
// week `offset` weeks from now.
function getDateForWeekDay(offset, dayOfWeek) {
  const d = getWeekMonday(offset);
  d.setDate(d.getDate() + dayOfWeek);
  return d;
}

function isPastDate(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

// Bookings close BOOKING_CUTOFF_MINUTES before the class starts. This is the
// display-side half of the rule -- api_book_slot() (supabase/migrations/
// 0007_booking_cutoff.sql) rejects a late booking for real, whatever a stale
// page still offers.
const BOOKING_CUTOFF_MINUTES = 60;

function isSlotBookableAt(dateISO, startHHMM) {
  const start = new Date(`${dateISO}T${startHHMM}:00`);
  return start.getTime() - Date.now() > BOOKING_CUTOFF_MINUTES * 60000;
}

function formatDateFR(date) {
  return date.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

// Local calendar date, NOT toISOString() -- every caller means "the day this
// course/carnet falls on in Paris". A Date at local midnight is the previous
// day in UTC (CEST = UTC+2), so toISOString() shifted courseDate a day early.
function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Renvoie true si le cours est annulable (> cancelHours avant l'heure du cours)
function isCancellable(booking) {
  if (booking.status === 'cancelled') return false;
  const infos = getInfos();
  const dt = new Date(booking.courseDate + 'T' + booking.slotStart + ':00');
  const hoursLeft = (dt - Date.now()) / 3600000;
  return hoursLeft > (infos.cancelHours || 24);
}

// Carnets et réservations par email (espace personnel client)
function getCarnetsByEmail(email) {
  if (!email) return [];
  const e = email.trim().toLowerCase();
  return getCarnets().filter(c => c.clientEmail && c.clientEmail.toLowerCase() === e);
}

function getBookingsByEmail(email) {
  if (!email) return [];
  const e = email.trim().toLowerCase();
  return getBookings().filter(b => b.clientEmail && b.clientEmail.toLowerCase() === e);
}

