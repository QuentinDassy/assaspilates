<?php
/**
 * GET /api/public-config.php
 *
 * Public, no auth -- serves only values that are safe in the browser. This
 * is what fixes the Stripe publishable key going out of sync across
 * computers: the admin panel used to save it into localStorage only
 * (site/admin/admin.js's old saveStripeConfig()), so it was empty on any
 * browser other than the one it was typed into, and the booking pages fell
 * back to a literal placeholder string. The real key always lives in
 * config.php on the server now, right next to STRIPE_SECRET_KEY, and this
 * endpoint is the only thing allowed to hand the public half of it to the browser.
 */

require_once __DIR__ . '/_lib/auth.php';

apbRequireMethod('GET');
$cfg = apbConfig();
apbJsonSuccess(['stripePublishableKey' => $cfg['STRIPE_PUBLISHABLE_KEY'] ?? '']);
