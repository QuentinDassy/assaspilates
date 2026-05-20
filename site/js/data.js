/**
 * Assas Pilates Ballet — Données partagées
 * Ce fichier est la source de vérité pour le site et l'admin.
 * Les données sont sauvegardées dans localStorage.
 */

const DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const DAYS_SHORT = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

const LOCATIONS = {
  assas: { name: 'Studio Assas', short: 'Assas', addr: '12, rue Duguay-Trouin — 75006 Paris', color: '#93bdb0' },
  lieu2: { name: 'Studio Munz Floor', short: 'Munz Floor', addr: '30, rue Monsieur Le Prince — 75006 Paris', color: '#2E6B30' },
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
  {id:1,name:'Leïla Dilhac',email:'',role:'Fondatrice · Danseuse Opéra de Paris',bio:'Leïla débute la danse à 6 ans à Cahors, entre au Conservatoire de Toulouse à 10 ans où elle obtient la Médaille d\'Or en 1996. Elle intègre le Corps de ballet de l\'Opéra de Paris à seulement 17 ans. Forte de 25 ans de carrière, elle crée Assas Pilates Ballet et enseigne la méthode Pilates classique.',tags:'Pilates classique,MUNZ FLOOR®,Diplôme d\'État danse',order:0,photo:'images/team-leila.jpg'},
  {id:2,name:'Marie Lacoste',email:'',role:'Instructrice Pilates',bio:'Danseuse classique diplômée d\'État depuis 1994, Marie se forme au Pilates en 2008 à A-LYNE Paris. Elle enseigne le Pilates, la barre au sol classique et propose des cours hybrides uniques.',tags:'Pilates,Barre au sol,Danse classique',order:1,photo:'images/team-marie.jpg'},
  {id:3,name:'Emily',email:'',role:'Instructrice Pilates & Chorégraphe',bio:'Certifiée POLESTAR en Pilates et formée au Gyrotonic, Emily possède un Diplôme d\'État en danse contemporaine. Fondatrice de la Compagnie N/KG, elle allie danse et approche thérapeutique.',tags:'Pilates POLESTAR,Gyrotonic,Shiatsu',order:2,photo:'images/team-emily.jpg'},
  {id:4,name:'William',email:'',role:'Masseur bien-être',bio:'Ancien danseur et chorégraphe aux Folies Bergères et La Nouvelle Eve, William apporte 15 ans d\'expertise en massage. Il a exercé à l\'Institut Figari et à l\'Opéra de Paris.',tags:'Massage Californien,Massage Suédois,Réflexologie',order:3,photo:'images/team-william.jpg'},
];

const DEFAULT_TARIFS = [
  // ---- Semi-Collectif Mat ----
  {id:1,  name:'Séance à l\'unité',  label:'Semi-Collectif Mat', sessions:'1 séance — Débutant / Intermédiaire', price:'30',   note:'',                      featured:false, isCarnet:false, type:'collectif'},
  {id:2,  name:'Carnet 5 séances',   label:'Semi-Collectif Mat', sessions:'5 séances — valable 3 mois',          price:'130',  note:'(soit 26 €/séance)',    featured:false, isCarnet:true,  sessionCount:5,  validityMonths:3,  type:'collectif'},
  {id:3,  name:'Carnet 10 séances',  label:'Semi-Collectif Mat', sessions:'10 séances — valable 6 mois',         price:'240',  note:'(soit 24 €/séance)',    featured:true,  isCarnet:true,  sessionCount:10, validityMonths:6,  type:'collectif'},
  {id:4,  name:'Carnet 20 séances',  label:'Semi-Collectif Mat', sessions:'20 séances — valable 12 mois',        price:'450',  note:'(soit 22,50 €/séance)', featured:false, isCarnet:true,  sessionCount:20, validityMonths:12, type:'collectif'},
  // ---- Formule découverte ----
  {id:5,  name:'Formule découverte', label:'1 cours collectif + 1 cours privé', sessions:'2 séances',           price:'95',   note:'',                      featured:false, isCarnet:false, type:'decouverte'},
  // ---- Duo Wall Unit ----
  {id:6,  name:'Séance à l\'unité',  label:'Cours Duo Wall Unit', sessions:'1 séance duo',                      price:'50',   note:'',                      featured:false, isCarnet:false, type:'duo'},
  {id:7,  name:'Carnet 5 séances',   label:'Cours Duo Wall Unit', sessions:'5 séances — valable 3 mois',        price:'230',  note:'(soit 46 €/séance)',    featured:false, isCarnet:true,  sessionCount:5,  validityMonths:3,  type:'duo'},
  {id:8,  name:'Carnet 10 séances',  label:'Cours Duo Wall Unit', sessions:'10 séances — valable 6 mois',       price:'440',  note:'(soit 44 €/séance)',    featured:false, isCarnet:true,  sessionCount:10, validityMonths:6,  type:'duo'},
  {id:9,  name:'Carnet 20 séances',  label:'Cours Duo Wall Unit', sessions:'20 séances — valable 12 mois',      price:'840',  note:'(soit 42 €/séance)',    featured:false, isCarnet:true,  sessionCount:20, validityMonths:12, type:'duo'},
  // ---- Privé Mat + Machine ----
  {id:10, name:'Séance à l\'unité',  label:'Cours Privé Mat + Machine', sessions:'1 séance individuelle',       price:'80',   note:'',                      featured:false, isCarnet:false, type:'prive'},
  {id:11, name:'Carnet 5 séances',   label:'Cours Privé Mat + Machine', sessions:'5 séances — valable 3 mois',  price:'380',  note:'(soit 76 €/séance)',    featured:false, isCarnet:true,  sessionCount:5,  validityMonths:3,  type:'prive'},
  {id:12, name:'Carnet 10 séances',  label:'Cours Privé Mat + Machine', sessions:'10 séances — valable 6 mois', price:'744',  note:'(soit 74,40 €/séance)', featured:false, isCarnet:true,  sessionCount:10, validityMonths:6,  type:'prive'},
  {id:13, name:'Carnet 20 séances',  label:'Cours Privé Mat + Machine', sessions:'20 séances — valable 12 mois',price:'1440', note:'(soit 72 €/séance)',    featured:false, isCarnet:true,  sessionCount:20, validityMonths:12, type:'prive'},
  // ---- Munz Floor ----
  {id:14, name:'Séance à l\'unité',  label:'Munz Floor', sessions:'1 séance',                      price:'35',  note:'',                     featured:false, isCarnet:false, type:'munz'},
  {id:15, name:'Carnet 10 séances',  label:'Munz Floor', sessions:'10 séances — valable 6 mois',   price:'300', note:'(soit 30 €/séance)',    featured:false, isCarnet:true,  sessionCount:10, validityMonths:6, type:'munz'},
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

function getSlots()    { return getData('slots',    DEFAULT_SLOTS);    }
function getTeam()     { return getData('team',     DEFAULT_TEAM);     }
function getTarifs()   { return getData('tarifs',   DEFAULT_TARIFS);   }
function getInfos()    { return getData('infos',    DEFAULT_INFOS);    }
function getCarnets()  { return getData('carnets',  DEFAULT_CARNETS);  }
function getBookings() { return getData('bookings', DEFAULT_BOOKINGS); }

function saveSlots(d)    { setData('slots',    d); }
function saveTeam(d)     { setData('team',     d); }
function saveTarifs(d)   { setData('tarifs',   d); }
function saveInfos(d)    { setData('infos',    d); }
function saveCarnets(d)  { setData('carnets',  d); }
function saveBookings(d) { setData('bookings', d); }

function getPasswords()   { return getData('passwords', {}); }
function savePasswords(d) { setData('passwords', d); }
function setClientPassword(email, password) {
  if (!email || !password) return;
  const pwds = getPasswords();
  pwds[email.trim().toLowerCase()] = password;
  savePasswords(pwds);
}
function checkClientPassword(email, password) {
  if (!email || !password) return false;
  const pwds = getPasswords();
  const stored = pwds[email.trim().toLowerCase()];
  return !!stored && stored === password;
}
function hasClientPassword(email) {
  if (!email) return false;
  return !!getPasswords()[email.trim().toLowerCase()];
}

// ===== UTILITIES =====
function generateCarnetCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let part = () => Array.from({length:4}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
  let code;
  const existing = getCarnets().map(c => c.code);
  do { code = 'APB-' + part() + '-' + part(); } while (existing.includes(code));
  return code;
}

function generateBookingId() {
  const ts  = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substr(2,4).toUpperCase();
  return 'RES-' + ts + '-' + rnd;
}

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

function formatDateFR(date) {
  return date.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

function formatDateISO(date) {
  return date.toISOString().split('T')[0];
}

// Renvoie true si le cours est annulable (> cancelHours avant l'heure du cours)
function isCancellable(booking) {
  if (booking.status === 'cancelled') return false;
  const infos = getInfos();
  const dt = new Date(booking.courseDate + 'T' + booking.slotStart + ':00');
  const hoursLeft = (dt - Date.now()) / 3600000;
  return hoursLeft > (infos.cancelHours || 24);
}

// Annule une réservation + restaure le crédit carnet si applicable
function cancelBooking(bookingId) {
  let bookings = getBookings();
  const idx = bookings.findIndex(b => b.id === bookingId);
  if (idx === -1) return false;
  bookings[idx].status = 'cancelled';
  bookings[idx].cancelledAt = new Date().toISOString();
  saveBookings(bookings);

  if (bookings[idx].paymentType === 'carnet' && bookings[idx].carnetCode) {
    let carnets = getCarnets();
    const ci = carnets.findIndex(c => c.code === bookings[idx].carnetCode);
    if (ci !== -1) {
      carnets[ci].remainingSessions = Math.min(carnets[ci].totalSessions, (carnets[ci].remainingSessions || 0) + 1);
      if (carnets[ci].remainingSessions > 0) carnets[ci].active = true;
      saveCarnets(carnets);
    }
  }
  return true;
}

// Valide un code carnet : renvoie l'objet carnet ou null
function validateCarnetCode(code) {
  if (!code) return null;
  const carnets = getCarnets();
  const c = carnets.find(x => x.code === code.trim().toUpperCase());
  if (!c || !c.active || c.remainingSessions <= 0) return null;
  if (c.expiresAt && new Date(c.expiresAt) < new Date()) return null;
  return c;
}

// ===== DEMO DATA =====
function seedDemoData() {
  const demoEmail = 'marie.dupont@demo.fr';
  if (getCarnets().find(c => c.code === 'APB-DEMO-2025') && getBookings().find(b => b.id === 'RES-DEMO18')) return demoEmail;

  const today = new Date();
  const d = (offset) => { const x = new Date(today); x.setDate(today.getDate() + offset); return formatDateISO(x); };

  if (!getCarnets().find(c => c.code === 'APB-DEMO-2025')) {

  const carnet = {
    code: 'APB-DEMO-2025', tarifId: 3, tarifName: 'Carnet 10 séances',
    totalSessions: 10, remainingSessions: 6, validityMonths: 6,
    expiresAt: d(180), active: true,
    clientEmail: demoEmail, clientFirstName: 'Marie', clientLastName: 'Dupont',
    clientPhone: '06 12 34 56 78', totalPaid: '350',
    purchasedAt: new Date(today.getTime() - 30 * 86400000).toISOString(),
    bookingIds: ['RES-DEMO1','RES-DEMO2','RES-DEMO3','RES-DEMO4'],
  };

  const mkBooking = (id, slotId, title, day, start, end, teacher, dateOffset, status, cancelOffset) => ({
    id, clientFirstName: 'Marie', clientLastName: 'Dupont', clientEmail: demoEmail,
    clientPhone: '06 12 34 56 78', slotId, slotTitle: title, slotDay: day,
    slotStart: start, slotEnd: end, teacher, courseDate: d(dateOffset),
    paymentType: 'carnet', carnetCode: 'APB-DEMO-2025', status,
    bookedAt: new Date(today.getTime() - 25 * 86400000).toISOString(),
    ...(cancelOffset ? { cancelledAt: new Date(today.getTime() + cancelOffset * 86400000).toISOString() } : {}),
  });

  const bookings = [
    mkBooking('RES-DEMO1', 13, 'Cours Semi Collectif Mat – INTERMÉDIAIRE', 2, '09:30', '10:25', 'Leïla Dilhac', 2, 'confirmed'),
    mkBooking('RES-DEMO2', 18, 'Cours Semi Collectif Mat – INTERMÉDIAIRE', 3, '10:00', '10:55', 'Leïla Dilhac', 9, 'confirmed'),
    mkBooking('RES-DEMO3', 23, 'Cours Semi Collectif Mat – INTERMÉDIAIRE', 4, '09:00', '09:55', 'Leïla Dilhac', 16, 'confirmed'),
    mkBooking('RES-DEMO4', 8,  'Cours Semi Collectif Mat – INTERMÉDIAIRE', 1, '10:00', '10:55', 'Leïla Dilhac', -7, 'confirmed'),
    mkBooking('RES-DEMO5', 1,  'Cours Semi Collectif Mat – DÉBUTANT',      0, '09:00', '09:55', 'Leïla Dilhac', -14, 'confirmed'),
    mkBooking('RES-DEMO6', 4,  'Cours Semi Collectif Mat – INTERMÉDIAIRE', 0, '12:00', '12:55', 'Leïla Dilhac', -10, 'cancelled', -8),
  ];

  // ---- Client 2 : Sophie Martin — Carnet 5 séances ----
  const email2 = 'sophie.martin@demo.fr';
  const carnet2 = {
    code: 'APB-DEMO-SOPHIE', tarifId: 2, tarifName: 'Carnet 5 séances',
    totalSessions: 5, remainingSessions: 3, validityMonths: 3,
    expiresAt: d(60), active: true,
    clientEmail: email2, clientFirstName: 'Sophie', clientLastName: 'Martin',
    clientPhone: '06 98 76 54 32', totalPaid: '200',
    purchasedAt: new Date(today.getTime() - 20 * 86400000).toISOString(),
    bookingIds: ['RES-DEMO7','RES-DEMO8'],
  };
  const mkB2 = (id, slotId, title, day, start, end, teacher, dateOffset, status) => ({
    id, clientFirstName:'Sophie', clientLastName:'Martin', clientEmail:email2,
    clientPhone:'06 98 76 54 32', slotId, slotTitle:title, slotDay:day,
    slotStart:start, slotEnd:end, teacher, courseDate:d(dateOffset),
    paymentType:'carnet', carnetCode:'APB-DEMO-SOPHIE', status,
    bookedAt: new Date(today.getTime() - 18 * 86400000).toISOString(),
  });

  // ---- Client 3 : Antoine Leclerc — cours privés à l'unité ----
  const email3 = 'antoine.leclerc@demo.fr';
  const mkB3 = (id, slotId, title, day, start, end, teacher, dateOffset, status, price) => ({
    id, clientFirstName:'Antoine', clientLastName:'Leclerc', clientEmail:email3,
    clientPhone:'07 11 22 33 44', slotId, slotTitle:title, slotDay:day,
    slotStart:start, slotEnd:end, teacher, courseDate:d(dateOffset),
    paymentType:'stripe', totalPaid:price, status,
    bookedAt: new Date(today.getTime() - 10 * 86400000).toISOString(),
  });

  // ---- Client 4 : Camille Rousseau — Carnet 10 séances ----
  const email4 = 'camille.rousseau@demo.fr';
  const carnet4 = {
    code: 'APB-DEMO-CAMILLE', tarifId: 3, tarifName: 'Carnet 10 séances',
    totalSessions: 10, remainingSessions: 4, validityMonths: 6,
    expiresAt: d(120), active: true,
    clientEmail: email4, clientFirstName: 'Camille', clientLastName: 'Rousseau',
    clientPhone: '06 55 44 33 22', totalPaid: '350',
    purchasedAt: new Date(today.getTime() - 90 * 86400000).toISOString(),
    bookingIds: ['RES-DEMO11','RES-DEMO12'],
  };
  const mkB4 = (id, slotId, title, day, start, end, teacher, dateOffset, status) => ({
    id, clientFirstName:'Camille', clientLastName:'Rousseau', clientEmail:email4,
    clientPhone:'06 55 44 33 22', slotId, slotTitle:title, slotDay:day,
    slotStart:start, slotEnd:end, teacher, courseDate:d(dateOffset),
    paymentType:'carnet', carnetCode:'APB-DEMO-CAMILLE', status,
    bookedAt: new Date(today.getTime() - 85 * 86400000).toISOString(),
  });

  const extraBookings = [
    // Sophie Martin
    mkB2('RES-DEMO7',  15, 'Cours Semi Collectif Mat – DÉBUTANT',      2, '18:00','18:55', 'Marie Lacoste', 5,  'confirmed'),
    mkB2('RES-DEMO8',  16, 'Cours Semi Collectif Mat – INTERMÉDIAIRE',  2, '19:00','19:55', 'Marie Lacoste', 12, 'confirmed'),
    mkB2('RES-DEMO9',  15, 'Cours Semi Collectif Mat – DÉBUTANT',      2, '18:00','18:55', 'Marie Lacoste', -5, 'confirmed'),
    mkB2('RES-DEMO10', 16, 'Cours Semi Collectif Mat – INTERMÉDIAIRE',  2, '19:00','19:55', 'Marie Lacoste', -12,'cancelled'),
    // Antoine Leclerc
    mkB3('RES-DEMO11', 2,  'Cours Privé Mat + Machine',                0, '10:00','10:55', 'Leïla Dilhac', 3,  'confirmed', 90),
    mkB3('RES-DEMO12', 9,  'Cours Privé Mat + Machine',                1, '11:00','11:55', 'Leïla Dilhac', 10, 'confirmed', 90),
    mkB3('RES-DEMO13', 14, 'Cours Privé Mat + Machine',                2, '10:30','11:25', 'Leïla Dilhac', -8, 'confirmed', 90),
    // Camille Rousseau
    mkB4('RES-DEMO14', 1,  'Cours Semi Collectif Mat – DÉBUTANT',      0, '09:00','09:55', 'Leïla Dilhac', 7,  'confirmed'),
    mkB4('RES-DEMO15', 4,  'Cours Semi Collectif Mat – INTERMÉDIAIRE', 0, '12:00','12:55', 'Leïla Dilhac', 14, 'confirmed'),
    mkB4('RES-DEMO16', 13, 'Cours Semi Collectif Mat – INTERMÉDIAIRE', 2, '09:30','10:25', 'Leïla Dilhac', -20,'confirmed'),
    mkB4('RES-DEMO17', 18, 'Cours Semi Collectif Mat – INTERMÉDIAIRE', 3, '10:00','10:55', 'Leïla Dilhac', -35,'confirmed'),
  ];

  const carnets = getCarnets();
  carnets.push(carnet); carnets.push(carnet2); carnets.push(carnet4);
  saveCarnets(carnets);
  const bks = getBookings();
  bookings.forEach(b => bks.push(b));
  extraBookings.forEach(b => bks.push(b));
  saveBookings(bks);
  setClientPassword(demoEmail, 'demo2025');
  setClientPassword(email2, 'demo2025');
  setClientPassword(email4, 'demo2025');
  }

  // ---- Client 5 : Lucas Bernard — carte bancaire, sans carnet ----
  // Guard séparé : s'ajoute même si le reste est déjà seedé
  if (getCarnets().find(c => c.code === 'APB-DEMO-2025') && !getBookings().find(b => b.id === 'RES-DEMO18')) {
    const today5  = new Date();
    const d5 = (offset) => { const x = new Date(today5); x.setDate(today5.getDate() + offset); return formatDateISO(x); };
    const email5  = 'lucas.bernard@demo.fr';
    const mkB5 = (id, slotId, title, day, start, end, teacher, dateOffset, status, price) => ({
      id, clientFirstName:'Lucas', clientLastName:'Bernard', clientEmail:email5,
      clientPhone:'06 33 44 55 66', slotId, slotTitle:title, slotDay:day,
      slotStart:start, slotEnd:end, teacher, courseDate:d5(dateOffset),
      paymentType:'stripe', totalPaid:price, status,
      createdAt: new Date(today5.getTime() - 5 * 86400000).toISOString(),
    });
    const lucasBookings = [
      mkB5('RES-DEMO18', 5,  'Cours Privé Mat + Machine', 0, '14:00', '14:55', 'Leïla Dilhac',  4, 'confirmed', 90),
      mkB5('RES-DEMO19', 7,  'Cours Duo Wall unit',       1, '09:00', '09:55', 'Leïla Dilhac', 11, 'confirmed', 120),
      mkB5('RES-DEMO20', 17, 'Cours Privé Mat + Machine', 3, '09:00', '09:55', 'Leïla Dilhac', -6, 'confirmed', 90),
    ];
    const bks5 = getBookings();
    lucasBookings.forEach(b => bks5.push(b));
    saveBookings(bks5);
    setClientPassword(email5, 'demo2025');
  }

  return demoEmail;
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

// Crée un carnet suite à un achat client
function createCarnetFromPurchase(tarifId, clientFirstName, clientLastName, clientEmail, clientPhone) {
  const tarifs = getTarifs();
  const tarif  = tarifs.find(t => t.id === tarifId);
  if (!tarif || !tarif.isCarnet) return null;

  const months = tarif.validityMonths || 3;
  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + months);

  const carnet = {
    code:              generateCarnetCode(),
    tarifId,
    tarifName:         tarif.name,
    type:              tarif.type || 'collectif',
    totalSessions:     tarif.sessionCount || parseInt(tarif.sessions) || 5,
    remainingSessions: tarif.sessionCount || parseInt(tarif.sessions) || 5,
    validityMonths:    months,
    expiresAt:         formatDateISO(expiry),
    active:            true,
    clientEmail:       clientEmail.trim().toLowerCase(),
    clientFirstName,
    clientLastName,
    clientPhone:       clientPhone || '',
    totalPaid:         tarif.price,
    purchasedAt:       new Date().toISOString(),
    bookingIds:        [],
  };

  const carnets = getCarnets();
  carnets.push(carnet);
  saveCarnets(carnets);
  return carnet;
}
