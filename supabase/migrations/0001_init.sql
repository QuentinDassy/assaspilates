-- Phase 0/1: read-mostly content tables (locations, slots, team, tarifs, site_settings)
-- Auth (clients/staff) lands in 0002_auth.sql (Phase 2).
-- Bookings/carnets/payment machinery lands in 0003_bookings.sql (Phase 3).

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ===== Locations =====
create table locations (
  key     text primary key,
  name    text not null,
  address text not null,
  color   text
);

insert into locations (key, name, address, color) values
  ('assas', 'Studio Assas', '12, rue Duguay-Trouin — 75006 Paris', '#6BB5A8'),
  ('lieu2', 'Studio Munz Floor', '30, rue Monsieur Le Prince — 75006 Paris', '#D68FA0');

-- ===== Slots (weekly recurring template) =====
create table slots (
  id            serial primary key,
  day_of_week   smallint not null check (day_of_week between 0 and 6), -- 0=Lundi ... 6=Dimanche
  start_time    time not null,
  end_time      time not null,
  title         text not null,
  type          text not null check (type in ('collectif','prive','duo','munz','decouverte')),
  teacher_name  text not null,
  location_key  text not null references locations(key),
  -- Seeded from the current hardcoded getAvailableSpots()/getPriceForSlot() in booking/index.html
  -- (prive=1, duo=2, else 8; price = the matching type's unit tarif). Correct these for real
  -- per-slot/location numbers via the admin UI once Phase 1 ships editable fields.
  capacity      int not null default 8,
  price_cents   int not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

insert into slots (id, day_of_week, start_time, end_time, title, type, teacher_name, location_key, capacity, price_cents) values
  (1,  0, '09:00', '09:55', 'Cours Semi Collectif Mat – DÉBUTANT',       'collectif', 'Leïla Dilhac', 'assas', 8, 3500),
  (2,  0, '10:00', '10:55', 'Cours Privé Mat + Machine',                 'prive',     'Leïla Dilhac', 'assas', 1, 9000),
  (3,  0, '11:00', '11:55', 'Cours Privé Mat + Machine',                 'prive',     'Leïla Dilhac', 'assas', 1, 9000),
  (4,  0, '12:00', '12:55', 'Cours Semi Collectif Mat – INTERMÉDIAIRE',  'collectif', 'Leïla Dilhac', 'assas', 8, 3500),
  (5,  0, '14:00', '14:55', 'Cours Privé Mat + Machine',                 'prive',     'Leïla Dilhac', 'assas', 1, 9000),
  (6,  0, '15:00', '15:55', 'Cours Privé Mat + Machine',                 'prive',     'Leïla Dilhac', 'assas', 1, 9000),
  (7,  1, '09:00', '09:55', 'Cours Duo Wall unit',                       'duo',       'Leïla Dilhac', 'assas', 2, 5000),
  (8,  1, '10:00', '10:55', 'Cours Semi Collectif Mat – INTERMÉDIAIRE',  'collectif', 'Leïla Dilhac', 'assas', 8, 3500),
  (9,  1, '11:00', '11:55', 'Cours Privé Mat + Machine',                 'prive',     'Leïla Dilhac', 'assas', 1, 9000),
  (10, 1, '12:00', '12:55', 'Cours Semi Collectif Mat – DÉBUTANT',       'collectif', 'Leïla Dilhac', 'assas', 8, 3500),
  (11, 1, '14:00', '14:55', 'Cours Privé Mat + Machine',                 'prive',     'Leïla Dilhac', 'assas', 1, 9000),
  (12, 1, '15:00', '15:55', 'Cours Privé Mat + Machine',                 'prive',     'Leïla Dilhac', 'assas', 1, 9000),
  (13, 2, '09:30', '10:25', 'Cours Semi Collectif Mat – INTERMÉDIAIRE',  'collectif', 'Leïla Dilhac', 'assas', 8, 3500),
  (14, 2, '10:30', '11:25', 'Cours Privé Mat + Machine',                 'prive',     'Leïla Dilhac', 'assas', 1, 9000),
  (15, 2, '18:00', '18:55', 'Cours Semi Collectif Mat – DÉBUTANT',       'collectif', 'Marie Lacoste', 'assas', 8, 3500),
  (16, 2, '19:00', '19:55', 'Cours Semi Collectif Mat – INTERMÉDIAIRE',  'collectif', 'Marie Lacoste', 'assas', 8, 3500),
  (17, 3, '09:00', '09:55', 'Cours Privé Mat + Machine',                 'prive',     'Leïla Dilhac', 'assas', 1, 9000),
  (18, 3, '10:00', '10:55', 'Cours Semi Collectif Mat – INTERMÉDIAIRE',  'collectif', 'Leïla Dilhac', 'assas', 8, 3500),
  (19, 3, '11:00', '11:55', 'Cours Privé Mat + Machine',                 'prive',     'Leïla Dilhac', 'assas', 1, 9000),
  (20, 3, '12:00', '12:55', 'Cours Semi Collectif Mat – DÉBUTANT',       'collectif', 'Leïla Dilhac', 'assas', 8, 3500),
  (21, 3, '14:00', '14:55', 'Cours Privé Mat + Machine',                 'prive',     'Leïla Dilhac', 'assas', 1, 9000),
  (22, 3, '15:00', '15:55', 'Cours Privé Mat + Machine',                 'prive',     'Leïla Dilhac', 'assas', 1, 9000),
  (23, 4, '09:00', '09:55', 'Cours Semi Collectif Mat – INTERMÉDIAIRE',  'collectif', 'Leïla Dilhac', 'assas', 8, 3500),
  (24, 4, '10:00', '10:55', 'Cours Privé Mat + Machine',                 'prive',     'Leïla Dilhac', 'assas', 1, 9000),
  (25, 4, '11:00', '11:55', 'Cours Semi Collectif Mat – DÉBUTANT',       'collectif', 'Leïla Dilhac', 'assas', 8, 3500),
  (26, 4, '13:00', '13:55', 'Cours Duo Wall unit',                       'duo',       'Leïla Dilhac', 'assas', 2, 5000),
  (27, 4, '14:00', '14:55', 'Cours Privé Mat + Machine',                 'prive',     'Leïla Dilhac', 'assas', 1, 9000),
  (28, 4, '15:00', '15:55', 'Cours Privé Mat + Machine',                 'prive',     'Leïla Dilhac', 'assas', 1, 9000),
  (29, 5, '10:30', '11:25', 'Cours Privé Mat + Machine',                 'prive',     'Leïla Dilhac', 'assas', 1, 9000),
  (30, 1, '10:00', '10:55', 'Cours Munz Floor — Niveau 1',               'munz',      'Leïla Dilhac', 'lieu2', 8, 3000),
  (31, 1, '11:00', '11:55', 'Cours Munz Floor — Niveau 2',               'munz',      'Leïla Dilhac', 'lieu2', 8, 3000),
  (32, 3, '10:00', '10:55', 'Cours Munz Floor — Niveau 1',               'munz',      'Leïla Dilhac', 'lieu2', 8, 3000),
  (33, 3, '11:00', '11:55', 'Cours Munz Floor — Niveau 2',               'munz',      'Leïla Dilhac', 'lieu2', 8, 3000),
  (34, 5, '09:30', '10:25', 'Cours Munz Floor — Niveau 1',               'munz',      'Marie Lacoste', 'lieu2', 8, 3000);

select setval('slots_id_seq', (select max(id) from slots));

-- ===== Team =====
create table team_members (
  id         serial primary key,
  name       text not null,
  email      citext,
  role       text,
  bio_html   text,
  tags       text[] not null default '{}',
  sort_order int not null default 0,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into team_members (id, name, email, role, bio_html, tags, sort_order, photo_path) values
  (1, 'Leïla Dilhac', null, 'Fondatrice · Danseuse Opéra de Paris',
   'Fondatrice du studio, Leïla a été danseuse à l''Opéra de Paris pendant vingt-cinq ans, une expérience qui a profondément façonné son regard sur le mouvement, la précision du geste et l''intelligence du corps.<br><br>Diplômée d''État de professeur de danse classique, elle a toujours eu à cœur de transmettre son expertise tout en explorant de nouvelles approches du mouvement. Certifiée en Pilates et en Munz Floor®, elle est également la créatrice de la Barre Aquatique, une méthode originale développée à partir de son expérience de la danse et de son intérêt pour le travail corporel en profondeur.',
   array['Pilates classique','MUNZ FLOOR®','Diplôme d''État danse'], 0, 'images/team-leila.jpg'),
  (2, 'Marie Lacoste', null, 'Instructrice Pilates',
   'Danseuse de formation et diplômée d''État en danse classique, Marie transmet depuis de nombreuses années sa passion du mouvement avec exigence, précision et bienveillance.<br><br>Formée au Pilates chez A-Lyne dès 2008, elle s''est spécialisée dans l''accompagnement du corps à travers une approche fondée sur l''alignement, la fluidité et la conscience du mouvement. Son expérience de la danse nourrit profondément son enseignement, lui permettant d''observer avec finesse chaque élève et d''adapter les exercices à ses besoins.<br><br>Ses cours allient rigueur, technique et plaisir du mouvement, dans une recherche constante d''équilibre, de force et d''harmonie corporelle.',
   array['Pilates','Barre au sol','Danse classique'], 1, 'images/team-marie.jpg'),
  (3, 'Emily Regent', null, 'Instructrice Pilates & Chorégraphe',
   'Son parcours s''est enrichi au fil des années par des formations en art-thérapie, en Gyrotonic et Shiatsu, lui offrant une vision globale de la personne et du mouvement. Cette complémentarité d''expertises lui permet d''accompagner chaque élève avec finesse, en tenant compte de son histoire corporelle, de ses besoins et de ses objectifs.<br><br>Elle transmet un Pilates exigeant et accessible, guidé par la recherche d''un mouvement plus libre, plus harmonieux et plus conscient.',
   array['Pilates POLESTAR','Gyrotonic','Shiatsu'], 2, 'images/team-emily.jpg'),
  (4, 'William Moundi', null, 'Masseur bien-être',
   'Ancien danseur et chorégraphe, William met au service de ses clients une connaissance approfondie du corps acquise à travers son parcours artistique et plus de quinze années d''expérience dans le domaine du bien-être.<br><br>Après avoir exercé au sein de l''Institut Figari pendant de nombreuses années, il intervient aujourd''hui auprès des artistes de l''Opéra de Paris. Son approche associe écoute, précision et qualité de présence afin de répondre aux besoins spécifiques de chacun.',
   array['Massage Californien','Massage Suédois','Réflexologie'], 3, 'images/team-william.jpg');

select setval('team_members_id_seq', (select max(id) from team_members));

-- ===== Tarifs (pricing/products) =====
create table tarifs (
  id               serial primary key,
  type             text not null check (type in ('collectif','prive','duo','munz','decouverte')),
  name             text not null,
  label            text not null,
  sessions_display text,
  price_cents      int not null,
  note             text,
  featured         boolean not null default false,
  is_carnet        boolean not null default false,
  session_count    int,
  validity_months  int,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint carnet_fields_required check (
    (is_carnet = false) or (session_count is not null and validity_months is not null)
  )
);

insert into tarifs (id, type, name, label, sessions_display, price_cents, note, featured, is_carnet, session_count, validity_months) values
  (1,  'collectif', 'Séance à l''unité', 'Semi-Collectif Mat', '1 séance — Débutant / Intermédiaire', 3500,  '', false, false, null, null),
  (2,  'collectif', 'Carnet 5 séances',  'Semi-Collectif Mat', '5 séances — valable 3 mois',           14000, '(soit 28 €/séance)', false, true, 5,  3),
  (3,  'collectif', 'Carnet 10 séances', 'Semi-Collectif Mat', '10 séances — valable 6 mois',          26000, '(soit 26 €/séance)', true,  true, 10, 6),
  (4,  'collectif', 'Carnet 20 séances', 'Semi-Collectif Mat', '20 séances — valable 12 mois',         48000, '(soit 24 €/séance)', false, true, 20, 12),
  (5,  'decouverte','Formule découverte','1 cours collectif + 1 cours privé', '2 séances',              9500,  '', false, false, null, null),
  (6,  'duo',       'Séance à l''unité', 'Cours Duo Wall Unit', '1 séance duo',                        5000,  '', false, false, null, null),
  (7,  'duo',       'Carnet 5 séances',  'Cours Duo Wall Unit', '5 séances — valable 3 mois',           23000, '(soit 46 €/séance)', false, true, 5,  3),
  (8,  'duo',       'Carnet 10 séances', 'Cours Duo Wall Unit', '10 séances — valable 6 mois',          44000, '(soit 44 €/séance)', false, true, 10, 6),
  (9,  'duo',       'Carnet 20 séances', 'Cours Duo Wall Unit', '20 séances — valable 12 mois',         84000, '(soit 42 €/séance)', false, true, 20, 12),
  (10, 'prive',     'Séance à l''unité', 'Cours Privé Mat + Machine', '1 séance individuelle',          9000,  '', false, false, null, null),
  (11, 'prive',     'Carnet 5 séances',  'Cours Privé Mat + Machine', '5 séances — valable 3 mois',     42500, '(soit 85 €/séance)', false, true, 5,  3),
  (12, 'prive',     'Carnet 10 séances', 'Cours Privé Mat + Machine', '10 séances — valable 6 mois',    80000, '(soit 80 €/séance)', false, true, 10, 6),
  (13, 'prive',     'Carnet 20 séances', 'Cours Privé Mat + Machine', '20 séances — valable 12 mois',   152000,'(soit 76 €/séance)', false, true, 20, 12),
  (14, 'munz',      'Séance à l''unité', 'Munz Floor', '1 séance',                                     3000,  '', false, false, null, null),
  (15, 'munz',      'Carnet 10 séances', 'Munz Floor', '10 séances — valable 6 mois',                  28000, '(soit 28 €/séance)', false, true, 10, 6),
  (16, 'munz',      'Carnet 20 séances', 'Munz Floor', '20 séances — valable 12 mois',                 54000, '(soit 27 €/séance)', false, true, 20, 12);

select setval('tarifs_id_seq', (select max(id) from tarifs));

-- ===== Site settings (singleton) =====
create table site_settings (
  id                  smallint primary key default 1 check (id = 1),
  addr1               text,
  addr2               text,
  phone               text,
  email               citext,
  instagram           text,
  cancel_hours        int not null default 24,
  late_minutes        int not null default 10,
  punctuality_message text,
  updated_at          timestamptz not null default now()
);

insert into site_settings (id, addr1, addr2, phone, email, instagram, cancel_hours, late_minutes, punctuality_message) values
  (1, '12, rue Duguay-Trouin, Paris 75006', '30, rue Monsieur Le Prince, Paris 75006', '07 45 19 24 61',
   'contact@assas-pilates-ballet.com', '@assaspilatesballet', 24, 10,
   'Au-delà de 10 minutes de retard, nous ne pourrons malheureusement pas vous accueillir en classe pour ne pas perturber le déroulement de la séance. Ce cours restera dû.');

-- ===== RLS: these 4 content tables are read-open, write-closed (writes only via service-role key from PHP) =====
alter table locations enable row level security;
alter table slots enable row level security;
alter table team_members enable row level security;
alter table tarifs enable row level security;
alter table site_settings enable row level security;

create policy "public read" on locations for select using (true);
create policy "public read" on slots for select using (true);
create policy "public read" on team_members for select using (true);
create policy "public read" on tarifs for select using (true);
create policy "public read" on site_settings for select using (true);
-- No insert/update/delete policies: anon/authenticated roles cannot write; only the
-- service_role key (used exclusively by site/api/*.php) bypasses RLS entirely.
