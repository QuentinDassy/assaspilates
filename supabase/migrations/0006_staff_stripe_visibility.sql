-- Phase 7: lets an admin account see everything in the panel except the
-- Stripe Config page (which today only shows the public pk + webhook URL,
-- no secrets -- this is a UI-visibility flag, not a new security boundary).
-- Needed for Leïla's admin account: full access, minus that one page.

alter table staff add column can_view_stripe_config boolean not null default true;
