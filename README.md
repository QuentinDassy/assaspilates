# Assas Pilates Ballet — Projet complet

## Structure du projet

```
assas-studio/
│
├── site/                          ← Site vitrine standalone (ouvrir dans VSCode Live Server)
│   ├── index.html                 ← Page principale (toutes les sections)
│   ├── css/
│   │   └── style.css              ← Styles du site vitrine
│   ├── js/
│   │   ├── data.js                ← Données partagées + localStorage (MODIFIER ICI)
│   │   └── site.js                ← Logique d'affichage du site
│   ├── admin/
│   │   ├── index.html             ← Panneau d'administration
│   │   ├── admin.css              ← Styles de l'admin
│   │   └── admin.js               ← Logique de l'admin
│   └── booking/
│       └── index.html             ← Module réservation (réplique Amelia + Stripe)
│
└── plugin/                        ← Plugin WordPress "Booking Manager"
    ├── booking-plugin.php          ← Point d'entrée du plugin
    ├── includes/
    │   ├── class-database.php     ← Création des tables BDD
    │   ├── class-course.php       ← Gestion des cours
    │   ├── class-booking.php      ← Gestion des réservations
    │   ├── class-stripe.php       ← Intégration Stripe API
    │   ├── class-email.php        ← Emails automatiques
    │   └── class-ajax.php         ← Endpoints AJAX + Webhook Stripe
    ├── admin/
    │   ├── class-admin.php        ← Tableau de bord WP
    │   ├── admin.css
    │   └── admin.js
    ├── public/
    │   ├── class-public.php       ← Shortcodes WordPress
    │   ├── css/public.css
    │   └── js/public.js           ← Stripe Elements front-end
    └── templates/
        ├── admin/                 ← Templates PHP du tableau de bord WP
        ├── emails/                ← Templates HTML des emails
        └── public/                ← Templates PHP front-end WP
```

---

## 1. Tester le site vitrine (VSCode)

### Prérequis
- VSCode + extension **Live Server** (ritwickdey.LiveServer)

### Lancer
1. Ouvrir le dossier `assas-studio/` dans VSCode
2. Clic droit sur `site/index.html` → **"Open with Live Server"**
3. Le site s'ouvre sur `http://127.0.0.1:5500/site/`

### Navigation
- **Site vitrine** : `site/index.html` — toutes les pages (Accueil, Équipe, Carnets, Studio, Infos)
- **Admin** : `site/admin/index.html` — gérer emploi du temps, équipe, tarifs
- **Réservation** : `site/booking/index.html` — module réservation (réplique Amelia)

### Note sur les données
Tout est sauvegardé en `localStorage`. Les modifications dans l'admin
s'appliquent instantanément sur le site (même navigateur, même origine).

---

## 2. Module Réservation (Stripe)

### En mode démo (sans Stripe)
La page `booking/index.html` simule un paiement réussi après 2 secondes.
Vous pouvez tester tout le flux sans clé Stripe.

### Connecter votre Stripe
1. Allez dans `site/admin/index.html` → **Configuration Stripe**
2. Entrez votre clé publique Stripe (`pk_test_...` ou `pk_live_...`)
3. La clé est sauvegardée et utilisée automatiquement par la page de réservation

En production (avec WordPress), le paiement est traité côté serveur
par le plugin. Voir la section Plugin ci-dessous.

---

## 3. Installer le Plugin WordPress

### Installation
1. Zippez le dossier `plugin/` → nommez-le `booking-manager.zip`
2. WordPress admin → **Extensions → Ajouter → Téléverser**
3. Activez le plugin

### Configuration Stripe dans WordPress
1. Aller dans **Réservations → Paramètres**
2. Entrer vos clés Stripe (test + production)
3. Copier l'URL webhook : `https://votre-site.com/wp-json/booking-manager/v1/webhook`
4. Dans le Dashboard Stripe → Webhooks → Ajouter cette URL
5. Événements à écouter : `payment_intent.succeeded`, `payment_intent.payment_failed`
6. Copier le Webhook Secret (`whsec_...`) et le coller dans les paramètres

### Shortcodes WordPress
```
[booking_courses]    ← Affiche les cours + formulaire de réservation avec paiement Stripe
[booking_manage]     ← Page de gestion pour les clients (annulation, modification)
```

### Fonctionnalités du plugin
- ✅ Création/gestion des cours en groupe (admin WP)
- ✅ Réservation avec paiement Stripe intégré (Stripe Elements)
- ✅ Email de confirmation automatique
- ✅ Email de rappel 24h avant le cours (WP Cron)
- ✅ Email d'annulation + remboursement Stripe automatique
- ✅ Notification admin à chaque réservation
- ✅ Webhook Stripe pour confirmer les paiements côté serveur
- ✅ Délai d'annulation configurable
- ✅ Tableau de bord admin (stats, liste cours, liste réservations)

---

## 4. Personnalisation

### Modifier les données par défaut
Dans `site/js/data.js` :
- `DEFAULT_SLOTS` → emploi du temps initial
- `DEFAULT_TEAM` → membres de l'équipe
- `DEFAULT_TARIFS` → formules et prix
- `DEFAULT_INFOS` → coordonnées

### Ajouter de vraies photos
Dans `site/index.html`, remplacez les blocs `.hero-img-placeholder` et `.studio-photo-ph`
par de vraies balises `<img>` :
```html
<img src="images/votre-photo.jpg" alt="Studio Assas Pilates Ballet">
```

### Changer les couleurs
Dans `site/css/style.css`, modifiez les variables CSS :
```css
:root {
  --cream: #FAF8F3;    /* fond général */
  --dark: #1a1a18;     /* noir principal */
  --warm: #8B7355;     /* brun chaud */
  --accent: #C4956A;   /* or/cuivre (liens, accents) */
}
```

---

## 5. Déploiement

### Option A : Site statique (GitHub Pages, Netlify, Vercel)
Déployez le dossier `site/` directement.
Le plugin WordPress ne sera pas actif — utilisez le mode démo pour la réservation.

### Option B : WordPress
1. Intégrez le HTML/CSS du site vitrine dans votre thème WordPress
2. Installez le plugin `plugin/`
3. Utilisez `[booking_courses]` pour la page de réservation
4. L'admin WordPress remplace `site/admin/`

---

## Contact
Studio Assas Pilates Ballet  
12, rue Duguay-Trouin — Paris 75006  
07 45 19 24 61 — contact@assas-pilates-ballet.com
