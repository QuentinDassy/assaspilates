<?php
if (!defined('ABSPATH')) exit;

class BM_Stripe {

    private $secret_key;
    private $api_base = 'https://api.stripe.com/v1';

    public function __construct() {
        $test_mode = get_option('bm_stripe_test_mode', '1');
        $this->secret_key = $test_mode
            ? get_option('bm_stripe_test_secret_key', '')
            : get_option('bm_stripe_secret_key', '');
    }

    /**
     * Créer un PaymentIntent Stripe
     */
    public function create_payment_intent($amount_cents, $currency, $metadata = []) {
        $response = $this->request('POST', '/payment_intents', [
            'amount'               => $amount_cents,
            'currency'             => strtolower($currency),
            'payment_method_types' => ['card'],
            'metadata'             => $metadata,
        ]);

        if (isset($response->error)) {
            return new WP_Error('stripe_error', $response->error->message);
        }

        return $response;
    }

    /**
     * Récupérer un PaymentIntent
     */
    public function get_payment_intent($payment_intent_id) {
        $response = $this->request('GET', "/payment_intents/{$payment_intent_id}");
        if (isset($response->error)) {
            return new WP_Error('stripe_error', $response->error->message);
        }
        return $response;
    }

    /**
     * Rembourser un PaymentIntent
     */
    public function refund($payment_intent_id, $amount = null) {
        $data = ['payment_intent' => $payment_intent_id];
        if ($amount !== null) {
            $data['amount'] = $amount;
        }

        $response = $this->request('POST', '/refunds', $data);
        if (isset($response->error)) {
            return new WP_Error('stripe_error', $response->error->message);
        }
        return $response;
    }

    /**
     * Valider un webhook Stripe
     */
    public function validate_webhook($payload, $sig_header) {
        $webhook_secret = get_option('bm_stripe_webhook_secret', '');
        if (empty($webhook_secret)) {
            return new WP_Error('no_webhook_secret', 'Webhook secret non configuré');
        }

        $parts = explode(',', $sig_header);
        $timestamp = null;
        $signatures = [];

        foreach ($parts as $part) {
            $part = trim($part);
            if (strpos($part, 't=') === 0) {
                $timestamp = substr($part, 2);
            } elseif (strpos($part, 'v1=') === 0) {
                $signatures[] = substr($part, 3);
            }
        }

        if (!$timestamp || empty($signatures)) {
            return new WP_Error('invalid_signature', 'Signature Stripe invalide');
        }

        // Tolérance de 5 minutes
        if (abs(time() - (int)$timestamp) > 300) {
            return new WP_Error('expired_signature', 'Webhook expiré');
        }

        $signed_payload = $timestamp . '.' . $payload;
        $expected_sig = hash_hmac('sha256', $signed_payload, $webhook_secret);

        foreach ($signatures as $sig) {
            if (hash_equals($expected_sig, $sig)) {
                return json_decode($payload);
            }
        }

        return new WP_Error('signature_mismatch', 'Signature Stripe ne correspond pas');
    }

    /**
     * Effectuer une requête à l'API Stripe
     */
    private function request($method, $endpoint, $data = []) {
        $args = [
            'method'  => $method,
            'headers' => [
                'Authorization' => 'Bearer ' . $this->secret_key,
                'Content-Type'  => 'application/x-www-form-urlencoded',
                'Stripe-Version' => '2023-10-16',
            ],
            'timeout' => 30,
        ];

        if ($method === 'POST' && !empty($data)) {
            $args['body'] = $this->build_query($data);
        }

        $url = $this->api_base . $endpoint;
        if ($method === 'GET' && !empty($data)) {
            $url .= '?' . http_build_query($data);
        }

        $response = wp_remote_request($url, $args);

        if (is_wp_error($response)) {
            return (object)['error' => (object)['message' => $response->get_error_message()]];
        }

        return json_decode(wp_remote_retrieve_body($response));
    }

    /**
     * Construire une query string pour les données imbriquées (metadata)
     */
    private function build_query($data, $prefix = '') {
        $parts = [];
        foreach ($data as $key => $value) {
            $full_key = $prefix ? "{$prefix}[{$key}]" : $key;
            if (is_array($value) || is_object($value)) {
                $parts[] = $this->build_query((array)$value, $full_key);
            } else {
                $parts[] = urlencode($full_key) . '=' . urlencode($value);
            }
        }
        return implode('&', $parts);
    }
}
