<?php
if (!defined('ABSPATH')) exit;

class BM_Ajax {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) self::$instance = new self();
        return self::$instance;
    }

    private function __construct() {
        // Actions AJAX publiques (non connecté)
        $actions = ['create_payment_intent', 'confirm_booking', 'get_course', 'cancel_booking', 'get_booking_by_token'];
        foreach ($actions as $action) {
            add_action("wp_ajax_{$action}", [$this, $action]);
            add_action("wp_ajax_nopriv_{$action}", [$this, $action]);
        }

        // Webhook Stripe (endpoint REST)
        add_action('rest_api_init', [$this, 'register_webhook_route']);
    }

    /**
     * Créer un PaymentIntent et une réservation en attente
     */
    public function create_payment_intent() {
        check_ajax_referer('bm_nonce', 'nonce');

        $course_id   = intval($_POST['course_id'] ?? 0);
        $participants = intval($_POST['participants'] ?? 1);
        $first_name  = sanitize_text_field($_POST['first_name'] ?? '');
        $last_name   = sanitize_text_field($_POST['last_name'] ?? '');
        $email       = sanitize_email($_POST['email'] ?? '');
        $phone       = sanitize_text_field($_POST['phone'] ?? '');

        if (!$course_id || !$email || !$first_name || !$last_name) {
            wp_send_json_error(['message' => __('Données manquantes.', 'booking-manager')]);
        }

        $course = (new BM_Course())->get($course_id);
        if (!$course || $course->status !== 'published') {
            wp_send_json_error(['message' => __('Cours introuvable.', 'booking-manager')]);
        }

        $spots = (new BM_Course())->get_spots_available($course_id);
        if ($spots < $participants) {
            wp_send_json_error(['message' => sprintf(__('Seulement %d place(s) disponible(s).', 'booking-manager'), $spots)]);
        }

        $total = $course->price * $participants;

        // Créer réservation en attente
        $booking_id = (new BM_Booking())->create([
            'course_id'    => $course_id,
            'user_id'      => get_current_user_id() ?: null,
            'first_name'   => $first_name,
            'last_name'    => $last_name,
            'email'        => $email,
            'phone'        => $phone,
            'participants' => $participants,
            'total_amount' => $total,
            'status'       => 'pending',
        ]);

        if (!$booking_id) {
            wp_send_json_error(['message' => __('Erreur lors de la création de la réservation.', 'booking-manager')]);
        }

        // Créer PaymentIntent Stripe
        $stripe = new BM_Stripe();
        $amount_cents = (int)round($total * 100);

        $intent = $stripe->create_payment_intent($amount_cents, $course->currency, [
            'booking_id' => $booking_id,
            'course_id'  => $course_id,
            'email'      => $email,
        ]);

        if (is_wp_error($intent)) {
            (new BM_Booking())->update($booking_id, ['status' => 'cancelled']);
            wp_send_json_error(['message' => $intent->get_error_message()]);
        }

        // Sauvegarder le payment_intent_id
        (new BM_Booking())->update($booking_id, [
            'stripe_payment_intent_id' => $intent->id,
        ]);

        wp_send_json_success([
            'client_secret' => $intent->client_secret,
            'booking_id'    => $booking_id,
            'total'         => number_format($total, 2),
            'currency'      => strtoupper($course->currency),
        ]);
    }

    /**
     * Confirmer une réservation après paiement Stripe réussi
     */
    public function confirm_booking() {
        check_ajax_referer('bm_nonce', 'nonce');

        $booking_id        = intval($_POST['booking_id'] ?? 0);
        $payment_intent_id = sanitize_text_field($_POST['payment_intent_id'] ?? '');

        if (!$booking_id || !$payment_intent_id) {
            wp_send_json_error(['message' => __('Données manquantes.', 'booking-manager')]);
        }

        // Vérifier le paiement côté Stripe
        $stripe = new BM_Stripe();
        $intent = $stripe->get_payment_intent($payment_intent_id);

        if (is_wp_error($intent) || $intent->status !== 'succeeded') {
            wp_send_json_error(['message' => __('Paiement non confirmé.', 'booking-manager')]);
        }

        $booking = (new BM_Booking())->get($booking_id);
        if (!$booking) {
            wp_send_json_error(['message' => __('Réservation introuvable.', 'booking-manager')]);
        }

        // Confirmer
        (new BM_Booking())->confirm($booking_id, $payment_intent_id);
        $booking = (new BM_Booking())->get($booking_id); // refresh
        $course  = (new BM_Course())->get($booking->course_id);

        // Emails
        $email = new BM_Email();
        $email->send_confirmation($booking, $course);
        $email->send_admin_notification($booking, $course);
        BM_Email::schedule_reminder($booking_id, $course);

        wp_send_json_success([
            'message' => __('Réservation confirmée !', 'booking-manager'),
            'token'   => (new BM_Booking())->generate_token($booking),
        ]);
    }

    /**
     * Récupérer les infos d'un cours
     */
    public function get_course() {
        $course_id = intval($_GET['course_id'] ?? 0);
        $course    = (new BM_Course())->get($course_id);

        if (!$course) {
            wp_send_json_error(['message' => 'Cours introuvable']);
        }

        $course->spots_available = (new BM_Course())->get_spots_available($course_id);
        wp_send_json_success($course);
    }

    /**
     * Récupérer une réservation via token (pour gestion client)
     */
    public function get_booking_by_token() {
        check_ajax_referer('bm_nonce', 'nonce');
        $token   = sanitize_text_field($_POST['token'] ?? '');
        $booking = (new BM_Booking())->get_by_token($token);

        if (!$booking) {
            wp_send_json_error(['message' => __('Réservation introuvable.', 'booking-manager')]);
        }

        $course = (new BM_Course())->get($booking->course_id);
        wp_send_json_success(['booking' => $booking, 'course' => $course]);
    }

    /**
     * Annuler une réservation (côté client)
     */
    public function cancel_booking() {
        check_ajax_referer('bm_nonce', 'nonce');

        $token  = sanitize_text_field($_POST['token'] ?? '');
        $reason = sanitize_text_field($_POST['reason'] ?? '');

        $booking = (new BM_Booking())->get_by_token($token);
        if (!$booking) {
            wp_send_json_error(['message' => __('Réservation introuvable.', 'booking-manager')]);
        }

        if (!in_array($booking->status, ['confirmed', 'pending'])) {
            wp_send_json_error(['message' => __('Cette réservation ne peut pas être annulée.', 'booking-manager')]);
        }

        $result = (new BM_Booking())->cancel($booking->id, $reason, true);

        if (is_wp_error($result)) {
            wp_send_json_error(['message' => $result->get_error_message()]);
        }

        wp_send_json_success(['message' => __('Votre réservation a été annulée et vous serez remboursé(e).', 'booking-manager')]);
    }

    /**
     * Webhook Stripe
     */
    public function register_webhook_route() {
        register_rest_route('booking-manager/v1', '/webhook', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_webhook'],
            'permission_callback' => '__return_true',
        ]);
    }

    public function handle_webhook($request) {
        $payload    = $request->get_body();
        $sig_header = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

        $stripe = new BM_Stripe();
        $event  = $stripe->validate_webhook($payload, $sig_header);

        if (is_wp_error($event)) {
            return new WP_REST_Response(['error' => $event->get_error_message()], 400);
        }

        switch ($event->type) {
            case 'payment_intent.succeeded':
                $intent     = $event->data->object;
                $booking_id = $intent->metadata->booking_id ?? null;
                if ($booking_id) {
                    $booking = (new BM_Booking())->get($booking_id);
                    if ($booking && $booking->status === 'pending') {
                        (new BM_Booking())->confirm($booking_id, $intent->id);
                        $course = (new BM_Course())->get($booking->course_id);
                        $booking = (new BM_Booking())->get($booking_id);
                        (new BM_Email())->send_confirmation($booking, $course);
                        (new BM_Email())->send_admin_notification($booking, $course);
                        BM_Email::schedule_reminder($booking_id, $course);
                    }
                }
                break;

            case 'payment_intent.payment_failed':
                $intent     = $event->data->object;
                $booking_id = $intent->metadata->booking_id ?? null;
                if ($booking_id) {
                    (new BM_Booking())->update($booking_id, ['status' => 'cancelled']);
                }
                break;
        }

        return new WP_REST_Response(['received' => true], 200);
    }
}
