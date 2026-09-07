-- Phase 2: real auth. clients decoupled from auth.users (nullable auth_user_id)
-- to support guest checkout later (Phase 3/4) -- a one-off unit booker gets a
-- clients row with no auth_user_id; this trigger links it if they later sign up
-- with the same email.

create table clients (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email        citext unique not null,
  first_name   text,
  last_name    text,
  phone        text,
  created_at   timestamptz not null default now()
);

create table staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role    text not null default 'admin' check (role in ('admin','staff_readonly'))
);

alter table clients enable row level security;
alter table staff enable row level security;

-- clients: no policies at all for anon/authenticated -- all reads/writes go
-- through the service-role PHP API once it's deployed. Nothing to expose here.

-- staff: a signed-in user may check whether THEY are staff (powers the admin
-- login screen's client-side gate); no one can read anyone else's row, and no
-- one can write to this table at all except the service-role key.
create policy "staff can read own row" on staff
  for select using (auth.uid() = user_id);

-- Links a newly created Supabase Auth user to a `clients` row by email --
-- creates one if this is a brand new email, or claims an existing guest-created
-- row (email match) if the person already had bookings/a carnet before signing up.
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into clients (auth_user_id, email)
  values (new.id, new.email)
  on conflict (email) do update set auth_user_id = excluded.auth_user_id;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
