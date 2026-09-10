-- Admin can register a student in person, recorded as paid on site
-- (cash/card at the studio) -- a third payment_type alongside the two online
-- ones. api_book_slot() (0003_bookings.sql) inserts p_payment_type verbatim
-- and only special-cases 'carnet' (session deduction), so nothing but this
-- CHECK needed widening; the function is unchanged. Used by
-- site/api/admin-book.php (the "Nouvelle réservation" action in the admin
-- Réservations tab).
alter table bookings drop constraint bookings_payment_type_check;
alter table bookings add constraint bookings_payment_type_check
  check (payment_type in ('stripe','carnet','onsite'));
