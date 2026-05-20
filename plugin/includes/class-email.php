<?php
if (!defined('ABSPATH')) exit;

class BM_Email {

    private $from_name;
    private $from_email;

    public function __construct() {
        $this->from_name  = get_option('bm_email_sender_name', get_bloginfo('name'));
        $this->from_email = get_option('bm_email_sender_email', get_option('admin_email'));
    }

    /**
     * Email de confirmation de réservation
     */
    public function send_confirmation($booking, $course) {
        $token = (new BM_Booking())->generate_token($booking);
        $manage_url = add_query_arg(['bm_action' => 'manage', 'token' => $token], home_url('/'));

        $subject = sprintf(__('Confirmation de votre réservation - %s', 'booking-manager'), $course->title);
        $body = $this->render_template('confirmation', [
            'booking'    => $booking,
            'course'     => $course,
            'manage_url' => $manage_url,
            'site_name'  => get_bloginfo('name'),
        ]);

        return $this->send($booking->email, $subject, $body, 'confirmation', $booking->id);
    }

    /**
     * Email de rappel (envoyé X heures avant le cours)
     */
    public function send_reminder($booking, $course) {
        $token = (new BM_Booking())->generate_token($booking);
        $manage_url = add_query_arg(['bm_action' => 'manage', 'token' => $token], home_url('/'));

        $subject = sprintf(__('Rappel - %s demain', 'booking-manager'), $course->title);
        $body = $this->render_template('reminder', [
            'booking'    => $booking,
            'course'     => $course,
            'manage_url' => $manage_url,
            'site_name'  => get_bloginfo('name'),
        ]);

        return $this->send($booking->email, $subject, $body, 'reminder', $booking->id);
    }

    /**
     * Email d'annulation
     */
    public function send_cancellation($booking, $refunded = false) {
        $course = (new BM_Course())->get($booking->course_id);
        $subject = sprintf(__('Annulation de votre réservation - %s', 'booking-manager'), $course ? $course->title : '');
        $body = $this->render_template('cancellation', [
            'booking'   => $booking,
            'course'    => $course,
            'refunded'  => $refunded,
            'site_name' => get_bloginfo('name'),
        ]);

        return $this->send($booking->email, $subject, $body, 'cancellation', $booking->id);
    }

    /**
     * Email admin pour nouvelle réservation
     */
    public function send_admin_notification($booking, $course) {
        $admin_email = get_option('admin_email');
        $subject = sprintf(__('[%s] Nouvelle réservation - %s', 'booking-manager'), get_bloginfo('name'), $course->title);
        $body = $this->render_template('admin-notification', [
            'booking'   => $booking,
            'course'    => $course,
            'admin_url' => admin_url('admin.php?page=bm-bookings&booking_id=' . $booking->id),
        ]);

        return $this->send($admin_email, $subject, $body, 'admin_notification', $booking->id);
    }

    /**
     * Planifier les rappels via WP Cron
     */
    public static function schedule_reminder($booking_id, $course) {
        $reminder_hours = (int) get_option('bm_email_reminder_hours', 24);
        $reminder_time  = strtotime($course->start_datetime) - ($reminder_hours * 3600);

        if ($reminder_time > time()) {
            wp_schedule_single_event($reminder_time, 'bm_send_reminder', [$booking_id]);
        }
    }

    /**
     * Envoyer un email
     */
    private function send($to, $subject, $body, $type = '', $booking_id = null) {
        add_filter('wp_mail_content_type', [$this, 'set_html_content_type']);
        add_filter('wp_mail_from', [$this, 'set_from_email']);
        add_filter('wp_mail_from_name', [$this, 'set_from_name']);

        $sent = wp_mail($to, $subject, $body);

        remove_filter('wp_mail_content_type', [$this, 'set_html_content_type']);
        remove_filter('wp_mail_from', [$this, 'set_from_email']);
        remove_filter('wp_mail_from_name', [$this, 'set_from_name']);

        // Log
        global $wpdb;
        $wpdb->insert(BM_Database::get_email_log_table(), [
            'booking_id' => $booking_id,
            'email_to'   => $to,
            'subject'    => $subject,
            'type'       => $type,
            'status'     => $sent ? 'sent' : 'failed',
        ]);

        return $sent;
    }

    /**
     * Rendre un template email
     */
    private function render_template($template_name, $vars = []) {
        extract($vars);
        ob_start();
        $template_file = BM_PLUGIN_DIR . "templates/emails/{$template_name}.php";
        if (file_exists($template_file)) {
            include $template_file;
        }
        return ob_get_clean();
    }

    public function set_html_content_type() { return 'text/html'; }
    public function set_from_email()         { return $this->from_email; }
    public function set_from_name()          { return $this->from_name; }
}

// Hook cron pour rappels
add_action('bm_send_reminder', function($booking_id) {
    $booking = (new BM_Booking())->get($booking_id);
    if (!$booking || $booking->status !== 'confirmed') return;
    $course = (new BM_Course())->get($booking->course_id);
    if ($course) {
        (new BM_Email())->send_reminder($booking, $course);
    }
});
