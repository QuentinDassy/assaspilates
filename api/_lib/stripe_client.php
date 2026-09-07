<?php
/**
 * Bootstraps the Stripe PHP SDK with the secret key from config.php.
 * Never expose the returned client or the secret key to the browser --
 * only the publishable key (apbConfig()['STRIPE_PUBLISHABLE_KEY']) is safe
 * client-side, served via api/public-config.php (Phase 5).
 */

require_once __DIR__ . '/config_loader.php';
require_once __DIR__ . '/../vendor/autoload.php';

function apbStripeClient(): \Stripe\StripeClient
{
    static $client = null;
    if ($client === null) {
        $cfg = apbConfig();
        $client = new \Stripe\StripeClient($cfg['STRIPE_SECRET_KEY']);
    }
    return $client;
}
