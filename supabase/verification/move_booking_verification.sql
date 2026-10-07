-- ===== Vérification manuelle de api_move_booking (migration 0012) =====
-- Pas une migration -- exécuter chaque bloc numéroté séparément dans le SQL
-- Editor (coller, Run, regarder la grille de résultats, puis le suivant).
-- Utilise deux clientes jetables et des dates à +40/+47 jours pour ne rien
-- percuter de réel ; le dernier bloc supprime tout.
--
-- Le cours 1 est un semi-collectif (voir 0001_init.sql) : c'est lui qui fait
-- jouer la règle « en attente d'un 2e élève », la partie la plus délicate du
-- déplacement.

-- 1) Deux clientes jetables
insert into clients (email, first_name, last_name) values
  ('move1@_migration_test.local', 'Move', 'One'),
  ('move2@_migration_test.local', 'Move', 'Two')
on conflict (email) do nothing;

-- 2) Une réservation sur le cours 1 à +40 jours -- attendu : status 'pending'
--    (première inscrite d'un semi-collectif)
select status, booking_ref, course_date from api_book_slot(
  (select id from clients where email = 'move1@_migration_test.local'),
  1, (current_date + 40), 'stripe', null, 3500, 'paid'
);

-- 3) Compteurs de l'occurrence de départ -- attendu : confirmed 0, pending 1
select confirmed_count, pending_count, capacity
from slot_occurrences where slot_id = 1 and course_date = current_date + 40;

-- 4) Le déplacement : même cours, 7 jours plus tard. Attendu : course_date
--    décalée, status toujours 'pending' (l'occurrence d'arrivée est vide)
select status, course_date, slot_title_snapshot from api_move_booking(
  (select id from bookings b join clients c on c.id = b.client_id
   where c.email = 'move1@_migration_test.local' and b.status <> 'cancelled'
   order by b.created_at desc limit 1),
  1, (current_date + 47)
);

-- 5) Les deux occurrences -- attendu : +40 remise à 0/0, +47 à 0 confirmés /
--    1 en attente. C'est le point qui comptait : la place quittée est bien
--    rendue, elle n'est pas comptée deux fois.
select course_date, confirmed_count, pending_count
from slot_occurrences
where slot_id = 1 and course_date in (current_date + 40, current_date + 47)
order by course_date;

-- 6) La deuxième cliente rejoint le cours à +47 -- attendu : 'confirmed',
--    et la réservation déplacée doit basculer 'confirmed' elle aussi
select status from api_book_slot(
  (select id from clients where email = 'move2@_migration_test.local'),
  1, (current_date + 47), 'stripe', null, 3500, 'paid'
);

-- 7) Attendu : les deux réservations en 'confirmed', occurrence à 2/0
select c.email, b.status, b.course_date
from bookings b join clients c on c.id = b.client_id
where c.email like '%_migration_test.local' and b.status <> 'cancelled'
order by c.email;

select confirmed_count, pending_count
from slot_occurrences where slot_id = 1 and course_date = current_date + 47;

-- 8) Déplacement refusé : date qui ne tombe pas le bon jour de semaine ?
--    Non -- cette garde-là est côté PHP (admin-bookings.php). Ce que la RPC
--    refuse, c'est une réservation annulée. Attendu : erreur BOOKING_CANCELLED
select api_cancel_booking(
  (select id from bookings b join clients c on c.id = b.client_id
   where c.email = 'move2@_migration_test.local' order by b.created_at desc limit 1),
  null, true
);

select api_move_booking(
  (select id from bookings b join clients c on c.id = b.client_id
   where c.email = 'move2@_migration_test.local' order by b.created_at desc limit 1),
  1, (current_date + 54)
);

-- 9) Ménage : supprime les réservations, les occurrences de test et les
--    deux clientes.
delete from bookings where client_id in
  (select id from clients where email like '%_migration_test.local');
delete from slot_occurrences
  where slot_id = 1 and course_date in (current_date + 40, current_date + 47, current_date + 54);
delete from clients where email like '%_migration_test.local';
