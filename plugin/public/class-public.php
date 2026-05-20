<?php
if (!defined('ABSPATH')) exit;

class BM_Public {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) self::$instance = new self();
        return self::$instance;
    }

    private function __construct() {
        add_action('wp_enqueue_scripts', [$this, 'enqueue_scripts']);
        add_shortcode('booking_courses', [$this, 'shortcode_courses']);
        add_shortcode('booking_manage', [$this, 'shortcode_manage']);
    }

    public function enqueue_scripts() {
        wp_enqueue_style('bm-public', BM_PLUGIN_URL . 'public/css/public.css', [], BM_VERSION);

        // Stripe.js
        wp_enqueue_script('stripe-js', 'https://js.stripe.com/v3/', [], null, true);

        wp_enqueue_script('bm-public', BM_PLUGIN_URL . 'public/js/public.js', ['jquery', 'stripe-js'], BM_VERSION, true);

        $test_mode = get_option('bm_stripe_test_mode', '1');
        $public_key = $test_mode
            ? get_option('bm_stripe_test_public_key', '')
            : get_option('bm_stripe_public_key', '');

        wp_localize_script('bm-public', 'bmConfig', [
            'ajaxUrl'        => admin_url('admin-ajax.php'),
            'nonce'          => wp_create_nonce('bm_nonce'),
            'stripePublicKey' => $public_key,
            'currency'       => 'EUR',
            'i18n'           => [
                'loading'       => __('Chargement...', 'booking-manager'),
                'book'          => __('Réserver', 'booking-manager'),
                'processing'    => __('Traitement...', 'booking-manager'),
                'error'         => __('Une erreur est survenue.', 'booking-manager'),
                'confirmCancel' => __('Êtes-vous sûr de vouloir annuler cette réservation ?', 'booking-manager'),
            ],
        ]);
    }

    /**
     * Shortcode [booking_courses] - liste les cours et permet la réservation
     */
    public function shortcode_courses($atts) {
        $atts = shortcode_atts([
            'limit'  => 12,
            'future' => true,
        ], $atts);

        $courses = (new BM_Course())->get_all([
            'limit'  => intval($atts['limit']),
            'future' => (bool)$atts['future'],
        ]);

        foreach ($courses as &$course) {
            $course->spots_available = (new BM_Course())->get_spots_available($course->id);
        }

        ob_start();
        include BM_PLUGIN_DIR . 'templates/public/courses-list.php';
        return ob_get_clean();
    }

    /**
     * Shortcode [booking_manage] - gestion des réservations client
     */
    public function shortcode_manage($atts) {
        $token = sanitize_text_field($_GET['token'] ?? '');
        $action = sanitize_text_field($_GET['bm_action'] ?? '');

        ob_start();
        include BM_PLUGIN_DIR . 'templates/public/manage-booking.php';
        return ob_get_clean();
    }
}
