<?php
if (!defined('ABSPATH')) exit;

class BM_Booking {

    private $table;

    public function __construct() {
        $this->table = BM_Database::get_bookings_table();
    }

    public function get($id) {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM {$this->table} WHERE id = %d", $id));
    }

    public function get_by_token($token) {
        // token = base64(booking_id:email)
        $decoded = base64_decode($token);
        if (!$decoded || strpos($decoded, ':') === false) return false;
        [$id, $email] = explode(':', $decoded, 2);
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$this->table} WHERE id = %d AND email = %s",
            intval($id), sanitize_email($email)
        ));
    }

    public function generate_token($booking) {
        return base64_encode($booking->id . ':' . $booking->email);
    }

    public function get_all($args = []) {
        global $wpdb;
        $defaults = ['course_id' => null, 'status' => null, 'limit' => 50, 'offset' => 0];
        $args = wp_parse_args($args, $defaults);

        $where = [];
        $values = [];

        if ($args['course_id']) {
            $where[] = 'b.course_id = %d';
            $values[] = $args['course_id'];
        }
        if ($args['status']) {
            $where[] = 'b.status = %s';
            $values[] = $args['status'];
        }

        $courses_table = BM_Database::get_courses_table();
        $where_sql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
        $query = "SELECT b.*, c.title as course_title, c.start_datetime as course_start
                  FROM {$this->table} b
                  LEFT JOIN $courses_table c ON b.course_id = c.id
                  $where_sql
                  ORDER BY b.created_at DESC
                  LIMIT %d OFFSET %d";
        $values[] = $args['limit'];
        $values[] = $args['offset'];

        return $wpdb->get_results($wpdb->prepare($query, $values));
    }

    public function create($data) {
        global $wpdb;
        $result = $wpdb->insert($this->table, $this->sanitize($data));
        return $result ? $wpdb->insert_id : false;
    }

    public function update($id, $data) {
        global $wpdb;
        return $wpdb->update($this->table, $data, ['id' => $id]);
    }

    public function confirm($id, $payment_intent_id) {
        return $this->update($id, [
            'status'                  => 'confirmed',
            'stripe_payment_intent_id' => $payment_intent_id,
        ]);
    }

    public function cancel($id, $reason = '', $refund = false) {
        $booking = $this->get($id);
        if (!$booking) return false;

        // Vérifier délai d'annulation
        if (!$refund) {
            $hours = (int) get_option('bm_cancellation_delay_hours', 24);
            $course = (new BM_Course())->get($booking->course_id);
            if ($course) {
                $course_start = strtotime($course->start_datetime);
                $now = time();
                if (($course_start - $now) < ($hours * 3600)) {
                    return new WP_Error('too_late', sprintf(
                        __('L\'annulation doit être effectuée au moins %d heures avant le cours.', 'booking-manager'),
                        $hours
                    ));
                }
            }
        }

        // Remboursement Stripe si paiement confirmé
        if ($refund && $booking->stripe_payment_intent_id && $booking->status === 'confirmed') {
            $stripe = new BM_Stripe();
            $refund_result = $stripe->refund($booking->stripe_payment_intent_id);
            if (is_wp_error($refund_result)) {
                return $refund_result;
            }
            $new_status = 'refunded';
        } else {
            $new_status = 'cancelled';
        }

        $this->update($id, [
            'status'               => $new_status,
            'cancellation_reason'  => $reason,
            'cancelled_at'         => current_time('mysql'),
        ]);

        // Envoyer email d'annulation
        $email = new BM_Email();
        $email->send_cancellation($booking, $refund);

        return true;
    }

    private function sanitize($data) {
        $allowed = ['course_id','user_id','first_name','last_name','email','phone','participants','total_amount','status','stripe_payment_intent_id','stripe_customer_id'];
        return array_intersect_key($data, array_flip($allowed));
    }
}
