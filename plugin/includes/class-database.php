<?php
if (!defined('ABSPATH')) exit;

class BM_Database {

    public static function install() {
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();

        $sql = [];

        // Table des cours
        $sql[] = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}bm_courses (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description LONGTEXT,
            instructor VARCHAR(255),
            location VARCHAR(255),
            start_datetime DATETIME NOT NULL,
            end_datetime DATETIME NOT NULL,
            max_capacity INT UNSIGNED NOT NULL DEFAULT 10,
            price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
            status ENUM('published','draft','cancelled') NOT NULL DEFAULT 'draft',
            stripe_price_id VARCHAR(255),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) $charset_collate;";

        // Table des réservations
        $sql[] = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}bm_bookings (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            course_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(50),
            participants INT UNSIGNED NOT NULL DEFAULT 1,
            total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            status ENUM('pending','confirmed','cancelled','refunded') NOT NULL DEFAULT 'pending',
            stripe_payment_intent_id VARCHAR(255),
            stripe_customer_id VARCHAR(255),
            cancellation_reason TEXT,
            cancelled_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES {$wpdb->prefix}bm_courses(id) ON DELETE CASCADE
        ) $charset_collate;";

        // Table des emails log
        $sql[] = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}bm_email_log (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            booking_id BIGINT UNSIGNED,
            email_to VARCHAR(255) NOT NULL,
            subject VARCHAR(255) NOT NULL,
            type VARCHAR(50),
            status ENUM('sent','failed') DEFAULT 'sent',
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) $charset_collate;";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        foreach ($sql as $query) {
            dbDelta($query);
        }

        // Options par défaut
        add_option('bm_stripe_test_mode', '1');
        add_option('bm_stripe_public_key', '');
        add_option('bm_stripe_secret_key', '');
        add_option('bm_stripe_webhook_secret', '');
        add_option('bm_cancellation_delay_hours', '24');
        add_option('bm_email_sender_name', get_bloginfo('name'));
        add_option('bm_email_sender_email', get_option('admin_email'));
        add_option('bm_email_reminder_hours', '24');

        update_option('bm_db_version', BM_VERSION);
    }

    public static function get_courses_table() {
        global $wpdb;
        return $wpdb->prefix . 'bm_courses';
    }

    public static function get_bookings_table() {
        global $wpdb;
        return $wpdb->prefix . 'bm_bookings';
    }

    public static function get_email_log_table() {
        global $wpdb;
        return $wpdb->prefix . 'bm_email_log';
    }
}
