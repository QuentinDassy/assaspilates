<?php
if (!defined('ABSPATH')) exit;

class BM_Admin {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) self::$instance = new self();
        return self::$instance;
    }

    private function __construct() {
        add_action('admin_menu', [$this, 'register_menus']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_scripts']);
        add_action('admin_post_bm_save_course', [$this, 'save_course']);
        add_action('admin_post_bm_delete_course', [$this, 'delete_course']);
        add_action('admin_post_bm_cancel_course', [$this, 'cancel_course']);
        add_action('admin_post_bm_cancel_booking', [$this, 'cancel_booking']);
        add_action('admin_post_bm_save_settings', [$this, 'save_settings']);
    }

    public function register_menus() {
        add_menu_page(
            __('Réservations', 'booking-manager'),
            __('Réservations', 'booking-manager'),
            'manage_options',
            'bm-dashboard',
            [$this, 'page_dashboard'],
            'dashicons-calendar-alt',
            30
        );

        add_submenu_page('bm-dashboard', __('Tableau de bord', 'booking-manager'), __('Tableau de bord', 'booking-manager'), 'manage_options', 'bm-dashboard', [$this, 'page_dashboard']);
        add_submenu_page('bm-dashboard', __('Cours', 'booking-manager'), __('Cours', 'booking-manager'), 'manage_options', 'bm-courses', [$this, 'page_courses']);
        add_submenu_page('bm-dashboard', __('Réservations', 'booking-manager'), __('Réservations', 'booking-manager'), 'manage_options', 'bm-bookings', [$this, 'page_bookings']);
        add_submenu_page('bm-dashboard', __('Paramètres', 'booking-manager'), __('Paramètres', 'booking-manager'), 'manage_options', 'bm-settings', [$this, 'page_settings']);
    }

    public function enqueue_scripts($hook) {
        if (strpos($hook, 'bm-') === false && strpos($hook, 'booking-manager') === false) return;
        wp_enqueue_style('bm-admin', BM_PLUGIN_URL . 'admin/admin.css', [], BM_VERSION);
        wp_enqueue_script('bm-admin', BM_PLUGIN_URL . 'admin/admin.js', ['jquery'], BM_VERSION, true);
    }

    public function page_dashboard() {
        global $wpdb;
        $courses_table = BM_Database::get_courses_table();
        $bookings_table = BM_Database::get_bookings_table();

        $stats = [
            'total_courses'    => $wpdb->get_var("SELECT COUNT(*) FROM $courses_table WHERE status = 'published'"),
            'upcoming_courses' => $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $courses_table WHERE status = 'published' AND start_datetime > %s", current_time('mysql'))),
            'total_bookings'   => $wpdb->get_var("SELECT COUNT(*) FROM $bookings_table WHERE status = 'confirmed'"),
            'revenue'          => $wpdb->get_var("SELECT COALESCE(SUM(total_amount), 0) FROM $bookings_table WHERE status IN ('confirmed','refunded')"),
        ];

        $upcoming = (new BM_Course())->get_all(['future' => true, 'limit' => 5]);
        $recent_bookings = (new BM_Booking())->get_all(['limit' => 10]);

        include BM_PLUGIN_DIR . 'templates/admin/dashboard.php';
    }

    public function page_courses() {
        $action = $_GET['action'] ?? 'list';
        $course_id = intval($_GET['course_id'] ?? 0);

        if ($action === 'edit' || $action === 'new') {
            $course = $course_id ? (new BM_Course())->get($course_id) : null;
            include BM_PLUGIN_DIR . 'templates/admin/course-form.php';
        } else {
            $courses = (new BM_Course())->get_all(['status' => 'all', 'limit' => 50]);
            include BM_PLUGIN_DIR . 'templates/admin/courses-list.php';
        }
    }

    public function page_bookings() {
        $course_id  = intval($_GET['course_id'] ?? 0);
        $status     = sanitize_text_field($_GET['status'] ?? '');
        $booking_id = intval($_GET['booking_id'] ?? 0);

        if ($booking_id) {
            $booking = (new BM_Booking())->get($booking_id);
            $course  = $booking ? (new BM_Course())->get($booking->course_id) : null;
            include BM_PLUGIN_DIR . 'templates/admin/booking-detail.php';
        } else {
            $bookings = (new BM_Booking())->get_all([
                'course_id' => $course_id ?: null,
                'status'    => $status ?: null,
                'limit'     => 50,
            ]);
            $courses = (new BM_Course())->get_all(['status' => 'all', 'limit' => 100]);
            include BM_PLUGIN_DIR . 'templates/admin/bookings-list.php';
        }
    }

    public function page_settings() {
        include BM_PLUGIN_DIR . 'templates/admin/settings.php';
    }

    public function save_course() {
        if (!current_user_can('manage_options') || !check_admin_referer('bm_save_course')) wp_die('Accès refusé');

        $course_id = intval($_POST['course_id'] ?? 0);
        $data = [
            'title'          => sanitize_text_field($_POST['title'] ?? ''),
            'description'    => wp_kses_post($_POST['description'] ?? ''),
            'instructor'     => sanitize_text_field($_POST['instructor'] ?? ''),
            'location'       => sanitize_text_field($_POST['location'] ?? ''),
            'start_datetime' => sanitize_text_field($_POST['start_datetime'] ?? ''),
            'end_datetime'   => sanitize_text_field($_POST['end_datetime'] ?? ''),
            'max_capacity'   => intval($_POST['max_capacity'] ?? 10),
            'price'          => floatval($_POST['price'] ?? 0),
            'currency'       => sanitize_text_field($_POST['currency'] ?? 'EUR'),
            'status'         => sanitize_text_field($_POST['status'] ?? 'draft'),
        ];

        if ($course_id) {
            (new BM_Course())->update($course_id, $data);
        } else {
            $course_id = (new BM_Course())->create($data);
        }

        wp_redirect(admin_url('admin.php?page=bm-courses&action=edit&course_id=' . $course_id . '&saved=1'));
        exit;
    }

    public function delete_course() {
        if (!current_user_can('manage_options') || !check_admin_referer('bm_delete_course')) wp_die('Accès refusé');
        $course_id = intval($_POST['course_id'] ?? 0);
        (new BM_Course())->delete($course_id);
        wp_redirect(admin_url('admin.php?page=bm-courses&deleted=1'));
        exit;
    }

    public function cancel_course() {
        if (!current_user_can('manage_options') || !check_admin_referer('bm_cancel_course')) wp_die('Accès refusé');
        $course_id = intval($_POST['course_id'] ?? 0);
        (new BM_Course())->cancel($course_id);
        wp_redirect(admin_url('admin.php?page=bm-courses&cancelled=1'));
        exit;
    }

    public function cancel_booking() {
        if (!current_user_can('manage_options') || !check_admin_referer('bm_cancel_booking')) wp_die('Accès refusé');
        $booking_id = intval($_POST['booking_id'] ?? 0);
        $refund     = isset($_POST['refund']) && $_POST['refund'] === '1';
        (new BM_Booking())->cancel($booking_id, 'Annulé par l\'administrateur', $refund);
        wp_redirect(admin_url('admin.php?page=bm-bookings&cancelled=1'));
        exit;
    }

    public function save_settings() {
        if (!current_user_can('manage_options') || !check_admin_referer('bm_save_settings')) wp_die('Accès refusé');

        $settings = [
            'bm_stripe_test_mode'        => isset($_POST['stripe_test_mode']) ? '1' : '0',
            'bm_stripe_public_key'       => sanitize_text_field($_POST['stripe_public_key'] ?? ''),
            'bm_stripe_secret_key'       => sanitize_text_field($_POST['stripe_secret_key'] ?? ''),
            'bm_stripe_test_public_key'  => sanitize_text_field($_POST['stripe_test_public_key'] ?? ''),
            'bm_stripe_test_secret_key'  => sanitize_text_field($_POST['stripe_test_secret_key'] ?? ''),
            'bm_stripe_webhook_secret'   => sanitize_text_field($_POST['stripe_webhook_secret'] ?? ''),
            'bm_cancellation_delay_hours' => intval($_POST['cancellation_delay_hours'] ?? 24),
            'bm_email_sender_name'       => sanitize_text_field($_POST['email_sender_name'] ?? ''),
            'bm_email_sender_email'      => sanitize_email($_POST['email_sender_email'] ?? ''),
            'bm_email_reminder_hours'    => intval($_POST['email_reminder_hours'] ?? 24),
        ];

        foreach ($settings as $key => $value) {
            update_option($key, $value);
        }

        wp_redirect(admin_url('admin.php?page=bm-settings&saved=1'));
        exit;
    }
}
