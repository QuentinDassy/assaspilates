-- api_book_slot() stored p_participants on the booking row as a label but
-- always consumed exactly 1 unit of slot_occurrences capacity regardless of
-- its value -- so a booking with participants=3 on a 1-person "prive" slot
-- (capacity 1) only counted as 1 toward capacity, letting the tracked count
-- silently drift from the real headcount and allowing genuine overbooking
-- (e.g. two different "duo" bookings, each claiming participants=2, both
-- succeeding on a capacity-2 slot -- 4 real people into a 2-person slot).
-- This makes every capacity check/increment scale with p_participants.
create or replace function api_book_slot(
  p_client_id uuid,
  p_slot_id int,
  p_course_date date,
  p_payment_type text,
  p_carnet_id uuid,
  p_total_paid_cents int,
  p_payment_status text,
  p_client_message text default null,
  p_participants int default 1
) returns bookings
language plpgsql
as $$
declare
  v_slot slots%rowtype;
  v_occ  slot_occurrences%rowtype;
  v_client clients%rowtype;
  v_booking bookings%rowtype;
begin
  if p_participants < 1 then
    raise exception 'INVALID_PARTICIPANTS';
  end if;

  select * into v_slot from slots where id = p_slot_id and active for update;
  if not found then
    raise exception 'SLOT_NOT_FOUND';
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

-- api_cancel_booking() had the matching bug: it always released exactly 1
-- unit of capacity, regardless of the booking's own participants count, so
-- cancelling a participants=2 booking only freed 1 of the 2 units it had
-- consumed -- counts would permanently drift upward. Release v_booking.participants
-- instead of a flat 1.
create or replace function api_cancel_booking(
  p_booking_id uuid,
  p_actor_client_id uuid,
  p_is_admin boolean default false
) returns bookings
language plpgsql
as $$
declare
  v_booking bookings%rowtype;
  v_occ slot_occurrences%rowtype;
  v_prev_status text;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;
  if not p_is_admin and v_booking.client_id <> p_actor_client_id then
    raise exception 'NOT_YOUR_BOOKING';
  end if;
  if v_booking.status = 'cancelled' then
    raise exception 'ALREADY_CANCELLED';
  end if;

  v_prev_status := v_booking.status;

  select * into v_occ from slot_occurrences where id = v_booking.slot_occurrence_id for update;

  update bookings set status = 'cancelled', cancelled_at = now()
    where id = p_booking_id
    returning * into v_booking;

  if v_prev_status = 'confirmed' then
    update slot_occurrences set confirmed_count = greatest(0, confirmed_count - v_booking.participants) where id = v_occ.id;
  else
    update slot_occurrences set pending_count = greatest(0, pending_count - v_booking.participants) where id = v_occ.id;
  end if;

  if v_booking.payment_type = 'carnet' and v_booking.carnet_id is not null then
    update carnets set
      remaining_sessions = least(total_sessions, remaining_sessions + 1),
      active = true
    where id = v_booking.carnet_id;
  end if;

  return v_booking;
end;
$$;
