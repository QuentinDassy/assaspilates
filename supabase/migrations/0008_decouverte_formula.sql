-- The "Formule découverte" (1 cours collectif + 1 cours privé, 95€) was
-- seeded in 0001_init.sql as a tarif but was never sellable: is_carnet was
-- false, so buy-carnet.html never listed it. Flipping that flag alone would
-- have issued a carnet of type 'decouverte', and api_book_slot() only lets a
-- carnet pay for a slot of its own type -- no slot carries 'decouverte', so
-- its two sessions could never have been spent.
--
-- carnets stay deliberately single-type: one type, one counter, one
-- row-locked decrement inside api_book_slot(). Rather than reopen that
-- function -- the concurrency- and money-critical one -- a formula spanning
-- two course types is sold as one carnet per component. The booking path
-- doesn't change at all; the buyer simply receives two codes.
alter table tarifs add column components jsonb;

comment on column tarifs.components is
  'Composite formulas only: [{"type":"collectif","sessions":1},...]. site/api/create-payment-intent.php issues one carnet per entry, splitting price_cents across them. NULL (the normal case) means a plain single-type carnet described by type/session_count.';

update tarifs set
  is_carnet       = true,
  validity_months = 3,
  session_count   = 2,
  components      = '[{"type":"collectif","sessions":1},{"type":"prive","sessions":1}]'::jsonb
where type = 'decouverte';
