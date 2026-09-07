-- ===== Manual verification for api_book_slot / api_cancel_booking =====
-- Not a migration -- run each numbered block separately in the SQL Editor
-- (paste one, Run, check the Results grid, then move to the next). Uses two
-- throwaway test clients and a slot occurrence 30 days out so it can't
-- collide with anything real; the last block deletes all of it.

-- 1) Two throwaway test clients
insert into clients (email, first_name, last_name) values
  ('test1@_migration_test.local', 'Test', 'One'),
  ('test2@_migration_test.local', 'Test', 'Two')
on conflict (email) do nothing;

-- 2) First booking for a collectif slot (id=1) -- expect status = 'pending'
--    (waiting for a 2nd student, per the "collectif" rule)
select status, booking_ref from api_book_slot(
  (select id from clients where email = 'test1@_migration_test.local'),
  1, (current_date + 30), 'stripe', null, 3500, 'paid'
);

-- 3) Second booking, same slot + same date -- expect status = 'confirmed',
--    AND booking #1 above should have flipped to 'confirmed' too (check step 5)
select status, booking_ref from api_book_slot(
  (select id from clients where email = 'test2@_migration_test.local'),
  1, (current_date + 30), 'stripe', null, 3500, 'paid'
);

-- 4) Check the occurrence counts -- expect confirmed_count = 2, pending_count = 0
select confirmed_count, pending_count, capacity
from slot_occurrences where slot_id = 1 and course_date = current_date + 30;

-- 5) Confirm booking #1 really did flip from pending to confirmed
select status, booking_ref from bookings
where client_id = (select id from clients where email = 'test1@_migration_test.local')
  and course_date = current_date + 30;

-- 6) Cancel test client 2's booking -- expect it to succeed and return status='cancelled'
select status from api_cancel_booking(
  (select id from bookings where client_id = (select id from clients where email = 'test2@_migration_test.local')
     and course_date = current_date + 30),
  (select id from clients where email = 'test2@_migration_test.local'),
  false
);

-- 7) Check the occurrence counts again -- expect confirmed_count = 1 now
select confirmed_count, pending_count, capacity
from slot_occurrences where slot_id = 1 and course_date = current_date + 30;

-- 8) SECURITY CHECK: test client 1 tries to cancel test client 2's already-cancelled
--    booking id directly is moot (already cancelled) -- instead verify a client can't
--    cancel someone ELSE's booking. This should raise "NOT_YOUR_BOOKING" (an error is
--    the CORRECT/expected outcome here, not a bug):
select status from api_cancel_booking(
  (select id from bookings where client_id = (select id from clients where email = 'test1@_migration_test.local')
     and course_date = current_date + 30),
  (select id from clients where email = 'test2@_migration_test.local'),  -- wrong client!
  false
);

-- 9) Cleanup -- run this last to remove all test data
delete from bookings where client_id in (
  select id from clients where email in ('test1@_migration_test.local','test2@_migration_test.local'));
delete from slot_occurrences where slot_id = 1 and course_date = current_date + 30;
delete from clients where email in ('test1@_migration_test.local','test2@_migration_test.local');
