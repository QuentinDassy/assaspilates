-- Inscription rétroactive depuis l'admin : placer une séance sur un cours
-- déjà passé (séance oubliée sur un carnet, élève venue sans être inscrite),
-- et accessoirement sur le cours du jour même, que la fermeture à 1h
-- interdisait aussi.
--
-- Jusqu'ici api_book_slot() appliquait la même fermeture à tout le monde et
-- n'avait aucun paramètre d'admin -- contrairement à api_cancel_booking().
-- On ajoute p_allow_past, que seul site/api/admin-book.php passe à true
-- (l'endpoint est derrière apbRequireAdmin()). Les chemins élève
-- (book-with-carnet.php, create-payment-intent.php) ne le passent pas et
-- gardent exactement le comportement actuel grâce au DEFAULT false.
--
-- Ce que p_allow_past relâche, et rien d'autre :
--   1. la fermeture des réservations 1h avant le début (BOOKING_TOO_LATE) ;
--   2. l'exigence que le cours soit encore actif au planning -- une séance
--      passée a pu avoir lieu sur un cours retiré depuis (les Munz Floor de
--      la migration 0005, par exemple).
--
-- Ce qui reste vérifié dans tous les cas, y compris en rétroactif :
--   - l'absence du professeur : une date où il était en vacances est une
--     date où le cours n'a pas eu lieu, l'inscrire serait une erreur ;
--   - la capacité (SLOT_FULL), pour ne pas inventer une 7e place ;
--   - la validité du carnet, dont expires_at >= p_course_date, qui se
--     comporte déjà correctement sur une date passée : un carnet expiré
--     depuis reste utilisable pour une séance qui, elle, a eu lieu pendant
--     sa validité.
--
-- Enfin, une réservation sur un cours passé est toujours 'confirmed' : le
-- statut 'pending' ("en attente d'un 2e élève") sert à décider si un
-- semi-collectif aura lieu, question déjà tranchée pour un cours donné.

-- CREATE OR REPLACE ne peut pas changer la signature : sans ce DROP, la
-- nouvelle fonction serait une SURCHARGE de l'ancienne, et un appel nommé à
-- 9 arguments deviendrait ambigu ("function is not unique") -- ce qui
-- casserait la réservation élève. La signature ci-dessous est exactement
-- celle déclarée en 0010_absence_time_window.sql.
drop function if exists api_book_slot(uuid, int, date, text, uuid, int, text, text, int);

create or replace function api_book_slot(
  p_client_id uuid,
  p_slot_id int,
  p_course_date date,
  p_payment_type text,
  p_carnet_id uuid,
  p_total_paid_cents int,
  p_payment_status text,
  p_client_message text default null,
  p_participants int default 1,
  p_allow_past boolean default false
) returns bookings
language plpgsql
as $$
declare
  v_slot slots%rowtype;
  v_occ  slot_occurrences%rowtype;
  v_client clients%rowtype;
  v_booking bookings%rowtype;
  v_is_past boolean;
begin
  if p_participants < 1 then
    raise exception 'INVALID_PARTICIPANTS';
  end if;

  -- En rétroactif on accepte aussi un cours retiré du planning (active =
  -- false) : il était bien au planning le jour où la séance a eu lieu.
  select * into v_slot from slots
    where id = p_slot_id and (active or p_allow_past)
    for update;
  if not found then
    raise exception 'SLOT_NOT_FOUND';
  end if;

  -- Absence : bloque si la date est dans la plage ET (pas de fenêtre horaire
  -- OU l'horaire du cours chevauche la fenêtre de l'absence).
  if v_slot.teacher_id is not null and exists (
    select 1 from teacher_absences ta
    where ta.team_member_id = v_slot.teacher_id
      and p_course_date between ta.start_date and ta.end_date
      and (
        ta.start_time is null
        or (v_slot.start_time < ta.end_time and v_slot.end_time > ta.start_time)
      )
  ) then
    raise exception 'TEACHER_ABSENT';
  end if;

  v_is_past := ((p_course_date + v_slot.start_time) at time zone 'Europe/Paris') <= now();

  if not p_allow_past
     and ((p_course_date + v_slot.start_time) at time zone 'Europe/Paris')
           <= now() + interval '1 hour' then
    raise exception 'BOOKING_TOO_LATE';
  end if;

  select * into v_client from clients where id = p_client_id;
  if not found then
    raise exception 'CLIENT_NOT_FOUND';
  end if;

  insert into slot_occurrences (slot_id, course_date, capacity)
    values (p_slot_id, p_course_date, v_slot.capacity)
    on conflict (slot_id, course_date) do nothing;

  select * into v_occ from slot_occurrences
    where slot_id = p_slot_id and course_date = p_course_date
    for update;

  if v_occ.status = 'cancelled' then
    raise exception 'SLOT_CANCELLED';
  end if;
  if v_occ.confirmed_count + v_occ.pending_count + p_participants > v_occ.capacity then
    raise exception 'SLOT_FULL';
  end if;

  if p_payment_type = 'carnet' then
    if p_carnet_id is null then
      raise exception 'CARNET_REQUIRED';
    end if;
    update carnets set remaining_sessions = remaining_sessions - 1
      where id = p_carnet_id and client_id = p_client_id and active
        and remaining_sessions > 0 and expires_at >= p_course_date
        and type = v_slot.type;
    if not found then
      raise exception 'CARNET_INVALID_OR_DEPLETED';
    end if;
    update carnets set active = false where id = p_carnet_id and remaining_sessions = 0;
  end if;

  insert into bookings (
    booking_ref, slot_id, slot_occurrence_id, client_id, course_date,
    slot_title_snapshot, slot_start_snapshot, slot_end_snapshot, slot_teacher_snapshot, slot_location_snapshot,
    client_first_name_snapshot, client_last_name_snapshot, client_phone_snapshot, client_message, participants,
    payment_type, carnet_id, total_paid_cents, payment_status, status
  ) values (
    'RES-' || upper(to_hex((extract(epoch from now()) * 1000)::bigint)) || '-' || upper(substr(md5(random()::text), 1, 4)),
    p_slot_id, v_occ.id, p_client_id, p_course_date,
    v_slot.title, v_slot.start_time, v_slot.end_time, v_slot.teacher_name, v_slot.location_key,
    coalesce(v_client.first_name, ''), coalesce(v_client.last_name, ''), v_client.phone, p_client_message, p_participants,
    p_payment_type, p_carnet_id, p_total_paid_cents, p_payment_status,
    case
      when v_is_past then 'confirmed'
      when v_slot.type <> 'collectif' then 'confirmed'
      when v_occ.confirmed_count = 0 and v_occ.pending_count = 0 then 'pending'
      else 'confirmed'
    end
  ) returning * into v_booking;

  if v_booking.status = 'confirmed' then
    if v_slot.type = 'collectif' and v_occ.pending_count > 0 then
      update bookings set status = 'confirmed'
        where slot_occurrence_id = v_occ.id and status = 'pending';
      update slot_occurrences
        set confirmed_count = confirmed_count + pending_count + p_participants, pending_count = 0
        where id = v_occ.id;
    else
      update slot_occurrences set confirmed_count = confirmed_count + p_participants where id = v_occ.id;
    end if;
  else
    update slot_occurrences set pending_count = pending_count + p_participants where id = v_occ.id;
  end if;

  return v_booking;
end;
$$;
