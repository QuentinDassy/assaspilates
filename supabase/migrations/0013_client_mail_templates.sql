-- Mails aux élèves, avec contenus éditables depuis l'admin.
--
-- Jusqu'ici le site n'écrivait qu'aux professeurs (site/api/_lib/mailer.php) :
-- une élève réservait, payait, et ne recevait rien. On ajoute cinq messages,
-- dont les textes vivent en base plutôt que dans le code -- c'est la demande,
-- et ça évite un déploiement pour corriger une tournure.
--
-- Le corps est du HTML écrit par le studio (onglet « Mails » de l'admin), et
-- les variables sont substituées à l'envoi. Les valeurs injectées viennent de
-- données client (prénom, nom, message), donc elles sont échappées au moment
-- de la substitution, dans apbRenderMailTemplate() -- le gabarit, lui, est
-- écrit par un admin et reste du HTML.
--
-- `enabled` permet de couper un message sans vider son texte : le studio
-- pourra se passer de l'accusé de modification sans le réécrire plus tard.

create table mail_templates (
  key         text primary key,
  label       text not null,        -- intitulé affiché dans l'admin
  description text not null,        -- quand ce message part
  subject     text not null,
  body_html   text not null,
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now()
);

alter table mail_templates enable row level security;
-- Aucune policy : lectures et écritures passent par le PHP en service_role
-- (site/api/admin-mail-templates.php et le mailer), jamais par le navigateur.
-- Un gabarit peut contenir des formulations internes, il n'a rien à faire
-- derrière la clé anon.

-- Savoir à qui le « votre cours est confirmé » a déjà été envoyé.
--
-- Dans un semi-collectif, la première inscrite reste 'pending' jusqu'à ce
-- qu'une deuxième s'inscrive ; c'est api_book_slot() qui les bascule toutes
-- en 'confirmed', à l'intérieur de sa transaction. Le PHP ne peut donc pas
-- savoir, après coup, lesquelles viennent de basculer. Cette colonne le dit :
-- une réservation confirmée jamais notifiée est exactement une réservation à
-- prévenir, et l'horodatage rend l'envoi idempotent même si deux requêtes se
-- croisent.
alter table bookings add column confirmed_notified_at timestamptz;

-- Les réservations déjà confirmées au moment de la migration ne doivent pas
-- déclencher une volée de mails rétroactifs au premier appel.
update bookings set confirmed_notified_at = now() where status = 'confirmed';

insert into mail_templates (key, label, description, subject, body_html) values
('booking_confirmed',
 'Réservation confirmée',
 'À l''élève, dès que sa réservation est confirmée (cours privé, duo, Munz, ou semi-collectif déjà confirmé).',
 'Votre réservation — {cours}, {date}',
 '<p>Bonjour {prenom},</p>
<p>Votre réservation est confirmée.</p>
<p><strong>{cours}</strong><br>{date}, {heure_debut}–{heure_fin}<br>{lieu}<br>Avec {professeur}</p>
<p>Référence : {reference}</p>
<p>À très vite,<br>Assas Pilates Ballet</p>'),

('booking_pending',
 'En attente d''un 2e élève',
 'À l''élève qui réserve la première place d''un semi-collectif : le cours n''est pas encore confirmé.',
 'Votre réservation est enregistrée — {cours}, {date}',
 '<p>Bonjour {prenom},</p>
<p>Votre réservation est enregistrée pour :</p>
<p><strong>{cours}</strong><br>{date}, {heure_debut}–{heure_fin}<br>{lieu}<br>Avec {professeur}</p>
<p>Ce cours est un semi-collectif : il a lieu à partir de deux élèves. Vous êtes la première inscrite, nous vous préviendrons dès qu''il sera confirmé.</p>
<p>Référence : {reference}</p>
<p>À très vite,<br>Assas Pilates Ballet</p>'),

('booking_now_confirmed',
 'Cours confirmé',
 'À l''élève en attente, quand une deuxième inscription confirme le semi-collectif.',
 'C''est confirmé — {cours}, {date}',
 '<p>Bonjour {prenom},</p>
<p>Bonne nouvelle : votre cours est confirmé.</p>
<p><strong>{cours}</strong><br>{date}, {heure_debut}–{heure_fin}<br>{lieu}<br>Avec {professeur}</p>
<p>Référence : {reference}</p>
<p>À très vite,<br>Assas Pilates Ballet</p>'),

('booking_cancelled',
 'Réservation annulée',
 'À l''élève quand sa réservation est annulée, par elle-même ou par le studio.',
 'Annulation — {cours}, {date}',
 '<p>Bonjour {prenom},</p>
<p>Votre réservation a été annulée :</p>
<p><strong>{cours}</strong><br>{date}, {heure_debut}–{heure_fin}<br>{lieu}</p>
<p>Si cette annulation n''est pas de votre fait ou si vous avez une question, écrivez-nous à {studio_email}.</p>
<p>Assas Pilates Ballet</p>'),

('booking_moved',
 'Réservation déplacée',
 'À l''élève quand le studio déplace sa réservation sur un autre cours ou une autre date.',
 'Votre cours a été déplacé — {cours}, {date}',
 '<p>Bonjour {prenom},</p>
<p>Votre réservation a été déplacée.</p>
<p><strong>Avant</strong><br>{ancien_cours}<br>{ancienne_date}, {ancienne_heure}</p>
<p><strong>Maintenant</strong><br>{cours}<br>{date}, {heure_debut}–{heure_fin}<br>{lieu}<br>Avec {professeur}</p>
<p>Si cet horaire ne vous convient pas, écrivez-nous à {studio_email}.</p>
<p>Assas Pilates Ballet</p>');
