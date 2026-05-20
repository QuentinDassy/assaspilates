<?php
/**
 * Plugin Name: Booking & Events Manager
 * Plugin URI: https://example.com
 * Description: Système de réservation de cours/événements en groupe avec paiement Stripe
 * Version: 1.0.0
 * Author: Custom Dev
 * Text Domain: booking-manager
 */

if (!defined('ABSPATH')) exit;

define('BM_VERSION', '1.0.0');
define('BM_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('BM_PLUGIN_URL', plugin_dir_url(__FILE__));
define('BM_PLUGIN_FILE', __FILE__);

// Autoload des classes
require_once BM_PLUGIN_DIR . 'includes/class-database.php';
require_once BM_PLUGIN_DIR . 'includes/class-course.php';
require_once BM_PLUGIN_DIR . 'includes/class-booking.php';
require_once BM_PLUGIN_DIR . 'includes/class-stripe.php';
require_once BM_PLUGIN_DIR . 'includes/class-email.php';
require_once BM_PLUGIN_DIR . 'includes/class-ajax.php';
require_once BM_PLUGIN_DIR . 'admin/class-admin.php';
require_once BM_PLUGIN_DIR . 'public/class-public.php';

class BookingManager {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('init', [$this, 'init']);
        add_action('plugins_loaded', [$this, 'load_textdomain']);
        register_activation_hook(BM_PLUGIN_FILE, ['BM_Database', 'install']);
        register_deactivation_hook(BM_PLUGIN_FILE, [$this, 'deactivate']);
    }

    public function init() {
        BM_Admin::get_instance();
        BM_Public::get_instance();
        BM_Ajax::get_instance();
    }

    public function load_textdomain() {
        load_plugin_textdomain('booking-manager', false, dirname(plugin_basename(BM_PLUGIN_FILE)) . '/languages');
    }

    public function deactivate() {
        flush_rewrite_rules();
    }
}

BookingManager::get_instance();
