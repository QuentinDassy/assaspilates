-- Phase 3: bookings/carnets machinery + the concurrency-safe booking RPC.
-- slot_occurrences is the new concept here: one row per concrete (slot, date)
-- pair, and the row-lock target that makes capacity checks and the collectif
-- "wait for 2nd student" rule safe across multiple simultaneous devices --
-- today's version (booking/index.html's saveNewBooking()) is a pure
-- client-side Array.forEach, safe only because each browser has isolated
-- fake data. That safety disappears the moment a real shared DB exists.

create table slot_occurrences (
  id              uuid primary key default gen_random_uuid(),
  slot_id         int not null references slots(id),
  course_date     date not null,
  capacity        int not null,
  confirmed_count int not null default 0,
  pending_count   int not null default 0,
  status          text not null default 'open' check (status in ('open','full','cancelled')),
  unique (slot_id, course_date)
);

create table payment_intents (
  id           text primary key,  -- Stripe PaymentIntent id (Phase 4); unused by the carnet path
  kind         text not null check (kind in ('booking','carnet')),
  amount_cents int not null,
  currency     text not null default 'eur',
  status       text not null default 'requires_payment_method',
  client_id    uuid not null references clients(id),
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table carnets (
  id                  uuid primary key default gen_random_uuid(),
  code                text unique not null,           -- APB-XXXX-XXXX, generated server-side
  client_id           uuid not null references clients(id),
  tarif_id            int references tarifs(id),
  tarif_name_snapshot text not null,
  type                text not null,
  total_sessions      int not null,
  remaining_sessions  int not null check (remaining_sessions between 0 and total_sessions),
  validity_months     int not null,
  purchased_at        timestamptz not null default now(),
  expires_at          date not null,
  active              boolean not null default true,
  total_paid_cents    int not null,
  payment_intent_id   text references payment_intents(id),
  status              text not null default 'active'
                        check (status in ('pending_payment','active','expired','deactivated'))
);

create table bookings (
  id                     uuid primary key default gen_random_uuid(),
  booking_ref            text unique not null,          -- human code, format RES-<ts36>-<rand4>
  slot_id                int references slots(id) on delete set null,
  slot_occurrence_id     uuid not null references slot_occurrences(id),
  client_id              uuid not null references clients(id),
  course_date            date not null,
  slot_title_snapshot    text not null,
  slot_start_snapshot    time not null,
  slot_end_snapshot      time not null,
  slot_teacher_snapshot  text not null,
  slot_location_snapshot text not null,
  client_first_name_snapshot text not null,
  client_last_name_snapshot  text not null,
  client_phone_snapshot  text,
  client_message         text,
  participants           int not null default 1,
  payment_type           text not null check (payment_type in ('stripe','carnet')),
  carnet_id              uuid references carnets(id),
  payment_intent_id      text references payment_intents(id),
  total_paid_cents       int not null default 0,
  payment_status         text not null default 'paid'
                            check (payment_status in ('awaiting_payment','paid','failed')),
  status                 text not null default 'confirmed'
                            check (status in ('pending','confirmed','cancelled')),
  created_at             timestamptz not null default now(),
  cancelled_at           timestamptz
);
create index on bookings (client_id);
create index on bookings (slot_occurrence_id);

alter table slot_occurrences enable row level security;
alter table payment_intents  enable row level security;
alter table carnets          enable row level security;
alter table bookings         enable row level security;
-- No policies on any of these for anon/authenticated: every read and write
-- goes through the service-role PHP API (site/api/*.php) once deployed, which
-- verifies the caller's JWT itself (site/api/_lib/auth.php) before scoping
-- queries to that client_id -- RLS here is pure defense-in-depth against a
-- stolen anon key, not the primary access-control mechanism.

-- ===== Concurrency-safe booking =====
-- SELECT ... FOR UPDATE on the slot_occurrences row for this exact
-- (slot_id, course_date) serializes every concurrent booking attempt on it,
-- so the capacity check and the "first booking -> pending, second -> both
-- confirmed" transition can never race, no matter how many devices call
-- this at once.
create or replace function api_book_slot(
  p_client_id uuid,
  p_slot_id int,
  p_course_date date,
  p_payment_type text,       -- 'carnet' | 'stripe'
  p_carnet_id uuid,          -- required when p_payment_type = 'carnet'
  p_total_paid_cents int,
  p_payment_status text,     -- 'paid' for carnet (deducted immediately); 'awaiting_payment' for stripe (Phase 4)
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
    for update;  -- <<< the concurrency lock

  if v_occ.status = 'cancelled' then
    raise exception 'SLOT_CANCELLED';
  end if;
  if v_occ.confirmed_count + v_occ.pending_count >= v_occ.capacity then
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
      -- this is the 2nd booking for this occurrence: flip the earlier pending one(s) too
      update bookings set status = 'confirmed'
        where slot_occurrence_id = v_occ.id and status = 'pending';
      update slot_occurrences
        set confirmed_count = confirmed_count + pending_count + 1, pending_count = 0
        where id = v_occ.id;
    else
      update slot_occurrences set confirmed_count = confirmed_count + 1 where id = v_occ.id;
    end if;
  else
    update slot_occurrences set pending_count = pending_count + 1 where id = v_occ.id;
  end if;

  return v_booking;
end;
$$;

-- Reverses a booking: restores the carnet session (if applicable) and the
-- slot_occurrences counts, under the same row-lock discipline.
create or replace function api_cancel_booking(
  p_booking_id uuid,
  p_actor_client_id uuid,  -- the caller's own client_id; ignored when p_is_admin
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

  v_prev_status := v_booking.status;  -- 'confirmed' or 'pending', captured before we touch it

  select * into v_occ from slot_occurrences where id = v_booking.slot_occurrence_id for update;

  update bookings set status = 'cancelled', cancelled_at = now()
    where id = p_booking_id
    returning * into v_booking;

  if v_prev_status = 'confirmed' then
    update slot_occurrences set confirmed_count = greatest(0, confirmed_count - 1) where id = v_occ.id;
  else
    update slot_occurrences set pending_count = greatest(0, pending_count - 1) where id = v_occ.id;
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
