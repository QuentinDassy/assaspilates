-- Déplacer une réservation : changer son cours et/ou sa date.
--
-- L'admin avait déjà le formulaire (« Modifier la réservation »), mais
-- saveBookingEdit() dans site/admin/admin.js n'écrivait que dans
-- localStorage -- aucun endpoint ne savait faire ça. L'écran affichait
-- « ✓ modifiée », la base ne bougeait pas, et la prochaine synchro effaçait
-- la modification. C'est ce qui s'est passé quand Muriel B a été déplacée du
-- 5 au 12 : rien n'a été enregistré.
--
-- Un déplacement touche deux occurrences (celle qu'on quitte et celle qu'on
-- rejoint) et doit rester cohérent face à une réservation simultanée sur
-- l'une ou l'autre : d'où une RPC qui verrouille les deux lignes
-- slot_occurrences, comme api_book_slot() verrouille la sienne. Le faire en
-- deux appels REST depuis PHP (annuler + recréer) perdrait l'identité de la
-- réservation, sa date de création, et rendrait une place disponible entre
-- les deux appels.
--
-- Ce qui reste vérifié, exactement comme à la réservation :
--   - l'absence du professeur sur la nouvelle date ;
--   - la capacité de la nouvelle occurrence (SLOT_FULL) ;
--   - la discipline du carnet, s'il y en a un : une séance de carnet
--     « collectif » ne peut pas être déplacée sur un cours privé, sinon le
--     décompte ne correspond plus à ce qui a été acheté.
--
-- p_allow_past joue le même rôle qu'en 0011_retroactive_booking.sql et n'est
-- passé qu'à true par site/api/admin-bookings.php, derrière apbRequireAdmin().

create or replace function api_move_booking(
  p_booking_id uuid,
  p_slot_id int,
  p_course_date date,
  p_allow_past boolean default false
) returns bookings
language plpgsql
as $$
declare
  v_booking bookings%rowtype;
  v_slot    slots%rowtype;
  v_old_occ slot_occurrences%rowtype;
  v_new_occ slot_occurrences%rowtype;
  v_carnet  carnets%rowtype;
  v_prev_status text;
  v_new_status  text;
  v_is_past boolean;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;
  if v_booking.status = 'cancelled' then
    raise exception 'BOOKING_CANCELLED';
  end if;

  -- Rien à faire : même cours, même date. On ressort la ligne telle quelle
  -- plutôt que de lever une erreur -- enregistrer sans avoir rien changé
  -- n'est pas une faute de l'utilisateur.
  if v_booking.slot_id = p_slot_id and v_booking.course_date = p_course_date then
    return v_booking;
  end if;

  -- Comme en rétroactif, un cours retiré du planning reste une cible valide :
  -- la séance a pu avoir lieu dessus.
  select * into v_slot from slots
    where id = p_slot_id and (active or p_allow_past)
    for update;
  if not found then
    raise exception 'SLOT_NOT_FOUND';
  end if;

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

  -- Une séance de carnet reste attachée à la discipline achetée.
  if v_booking.payment_type = 'carnet' and v_booking.carnet_id is not null then
    select * into v_carnet from carnets where id = v_booking.carnet_id;
    if found and v_carnet.type <> v_slot.type then
      raise exception 'CARNET_WRONG_TYPE';
    end if;
  end if;

  -- Toujours verrouiller les deux occurrences dans le même ordre (par id),
  -- sinon deux déplacements croisés entre les deux mêmes cours peuvent se
  -- bloquer mutuellement.
  insert into slot_occurrences (slot_id, course_date, capacity)
    values (p_slot_id, p_course_date, v_slot.capacity)
    on conflict (slot_id, course_date) do nothing;

  if v_booking.slot_occurrence_id <
     (select id from slot_occurrences where slot_id = p_slot_id and course_date = p_course_date)
  then
    select * into v_old_occ from slot_occurrences where id = v_booking.slot_occurrence_id for update;
    select * into v_new_occ from slot_occurrences
      where slot_id = p_slot_id and course_date = p_course_date for update;
  else
    select * into v_new_occ from slot_occurrences
      where slot_id = p_slot_id and course_date = p_course_date for update;
    select * into v_old_occ from slot_occurrences where id = v_booking.slot_occurrence_id for update;
  end if;

  if v_new_occ.status = 'cancelled' then
    raise exception 'SLOT_CANCELLED';
  end if;
  if v_new_occ.confirmed_count + v_new_occ.pending_count + v_booking.participants > v_new_occ.capacity then
    raise exception 'SLOT_FULL';
  end if;

  v_prev_status := v_booking.status;

  -- On libère la place sur l'occurrence quittée. Comme api_cancel_booking(),
  -- on ne redescend pas en 'pending' un semi-collectif qui retomberait à un
  -- seul inscrit : le cours a été annoncé comme confirmé à l'élève restant.
  if v_prev_status = 'confirmed' then
    update slot_occurrences set confirmed_count = greatest(0, confirmed_count - v_booking.participants)
      where id = v_old_occ.id;
  else
    update slot_occurrences set pending_count = greatest(0, pending_count - v_booking.participants)
      where id = v_old_occ.id;
  end if;

  -- Statut à l'arrivée : même règle qu'à la réservation.
  v_new_status := case
    when v_is_past then 'confirmed'
    when v_slot.type <> 'collectif' then 'confirmed'
    when v_new_occ.confirmed_count = 0 and v_new_occ.pending_count = 0 then 'pending'
    else 'confirmed'
  end;

  update bookings set
    slot_id                = p_slot_id,
    slot_occurrence_id     = v_new_occ.id,
    course_date            = p_course_date,
    slot_title_snapshot    = v_slot.title,
    slot_start_snapshot    = v_slot.start_time,
    slot_end_snapshot      = v_slot.end_time,
    slot_teacher_snapshot  = v_slot.teacher_name,
    slot_location_snapshot = v_slot.location_key,
    status                 = v_new_status
  where id = p_booking_id
  returning * into v_booking;

  if v_new_status = 'confirmed' then
    if v_slot.type = 'collectif' and v_new_occ.pending_count > 0 then
      -- L'arrivante confirme le semi-collectif : les élèves en attente sur
      -- cette occurrence passent confirmés avec elle.
      update bookings set status = 'confirmed'
        where slot_occurrence_id = v_new_occ.id and status = 'pending';
      update slot_occurrences
        set confirmed_count = confirmed_count + pending_count + v_booking.participants,
            pending_count = 0
        where id = v_new_occ.id;
    else
      update slot_occurrences set confirmed_count = confirmed_count + v_booking.participants
        where id = v_new_occ.id;
    end if;
  else
    update slot_occurrences set pending_count = pending_count + v_booking.participants
      where id = v_new_occ.id;
  end if;

  return v_booking;
end;
$$;
