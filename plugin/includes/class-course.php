<?php
if (!defined('ABSPATH')) exit;

class BM_Course {

    private $table;

    public function __construct() {
        $this->table = BM_Database::get_courses_table();
    }

    public function get_all($args = []) {
        global $wpdb;
        $defaults = [
            'status'  => 'published',
            'limit'   => 20,
            'offset'  => 0,
            'future'  => false,
            'orderby' => 'start_datetime',
            'order'   => 'ASC',
        ];
        $args = wp_parse_args($args, $defaults);

        $where = [];
        $values = [];

        if ($args['status'] !== 'all') {
            $where[] = 'status = %s';
            $values[] = $args['status'];
        }

        if ($args['future']) {
            $where[] = 'start_datetime > %s';
            $values[] = current_time('mysql');
        }

        $where_sql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
        $orderby   = sanitize_sql_orderby("{$args['orderby']} {$args['order']}") ?: 'start_datetime ASC';

        $query = "SELECT * FROM {$this->table} $where_sql ORDER BY $orderby LIMIT %d OFFSET %d";
        $values[] = $args['limit'];
        $values[] = $args['offset'];

        return $wpdb->get_results($wpdb->prepare($query, $values));
    }

    public function get($id) {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM {$this->table} WHERE id = %d", $id));
    }

    public function create($data) {
        global $wpdb;
        $result = $wpdb->insert($this->table, $this->sanitize($data));
        return $result ? $wpdb->insert_id : false;
    }

    public function update($id, $data) {
        global $wpdb;
        return $wpdb->update($this->table, $this->sanitize($data), ['id' => $id]);
    }

    public function delete($id) {
        global $wpdb;
        return $wpdb->delete($this->table, ['id' => $id]);
    }

    public function get_spots_available($course_id) {
        global $wpdb;
        $course = $this->get($course_id);
        if (!$course) return 0;

        $bookings_table = BM_Database::get_bookings_table();
        $booked = $wpdb->get_var($wpdb->prepare(
            "SELECT COALESCE(SUM(participants), 0) FROM $bookings_table WHERE course_id = %d AND status IN ('confirmed','pending')",
            $course_id
        ));

        return max(0, $course->max_capacity - (int)$booked);
    }

    public function cancel($id) {
        global $wpdb;
        $bookings_table = BM_Database::get_bookings_table();

        // Annuler tous les réservations liées
        $bookings = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $bookings_table WHERE course_id = %d AND status = 'confirmed'",
            $id
        ));

        $booking_obj = new BM_Booking();
        foreach ($bookings as $booking) {
            $booking_obj->cancel($booking->id, 'Cours annulé par l\'administrateur', true);
        }

        return $this->update($id, ['status' => 'cancelled']);
    }

    private function sanitize($data) {
        $allowed = ['title','description','instructor','location','start_datetime','end_datetime','max_capacity','price','currency','status','stripe_price_id'];
        return array_intersect_key($data, array_flip($allowed));
    }
}
