<?php if (!defined('ABSPATH')) exit; ?>
<div class="wrap bm-admin">
    <h1><?php _e('Réservations', 'booking-manager'); ?></h1>

    <?php if (isset($_GET['cancelled'])): ?>
        <div class="notice notice-success"><p><?php _e('Réservation annulée.', 'booking-manager'); ?></p></div>
    <?php endif; ?>

    <div class="bm-filters">
        <form method="get">
            <input type="hidden" name="page" value="bm-bookings">
            <select name="course_id">
                <option value=""><?php _e('Tous les cours', 'booking-manager'); ?></option>
                <?php foreach ($courses as $c): ?>
                    <option value="<?php echo $c->id; ?>" <?php selected($_GET['course_id'] ?? '', $c->id); ?>><?php echo esc_html($c->title); ?></option>
                <?php endforeach; ?>
            </select>
            <select name="status">
                <option value=""><?php _e('Tous les statuts', 'booking-manager'); ?></option>
                <option value="confirmed" <?php selected($_GET['status'] ?? '', 'confirmed'); ?>><?php _e('Confirmées', 'booking-manager'); ?></option>
                <option value="pending" <?php selected($_GET['status'] ?? '', 'pending'); ?>><?php _e('En attente', 'booking-manager'); ?></option>
                <option value="cancelled" <?php selected($_GET['status'] ?? '', 'cancelled'); ?>><?php _e('Annulées', 'booking-manager'); ?></option>
                <option value="refunded" <?php selected($_GET['status'] ?? '', 'refunded'); ?>><?php _e('Remboursées', 'booking-manager'); ?></option>
            </select>
            <button type="submit" class="button"><?php _e('Filtrer', 'booking-manager'); ?></button>
        </form>
    </div>

    <table class="wp-list-table widefat fixed striped">
        <thead>
            <tr>
                <th>#</th>
                <th><?php _e('Client', 'booking-manager'); ?></th>
                <th><?php _e('Email', 'booking-manager'); ?></th>
                <th><?php _e('Cours', 'booking-manager'); ?></th>
                <th><?php _e('Participants', 'booking-manager'); ?></th>
                <th><?php _e('Montant', 'booking-manager'); ?></th>
                <th><?php _e('Statut', 'booking-manager'); ?></th>
                <th><?php _e('Date réservation', 'booking-manager'); ?></th>
                <th><?php _e('Actions', 'booking-manager'); ?></th>
            </tr>
        </thead>
        <tbody>
            <?php if (empty($bookings)): ?>
            <tr><td colspan="9" style="text-align:center;padding:20px;"><?php _e('Aucune réservation trouvée.', 'booking-manager'); ?></td></tr>
            <?php else: foreach ($bookings as $b): ?>
            <tr>
                <td><?php echo $b->id; ?></td>
                <td><strong><?php echo esc_html($b->first_name . ' ' . $b->last_name); ?></strong></td>
                <td><a href="mailto:<?php echo esc_attr($b->email); ?>"><?php echo esc_html($b->email); ?></a></td>
                <td><?php echo esc_html($b->course_title ?? '—'); ?></td>
                <td><?php echo esc_html($b->participants); ?></td>
                <td><?php echo number_format($b->total_amount, 2, ',', ' '); ?> €</td>
                <td><span class="bm-status bm-status-<?php echo esc_attr($b->status); ?>"><?php echo esc_html($b->status); ?></span></td>
                <td><?php echo esc_html(date_i18n('d/m/Y H:i', strtotime($b->created_at))); ?></td>
                <td>
                    <a href="<?php echo admin_url('admin.php?page=bm-bookings&booking_id=' . $b->id); ?>" class="button button-small"><?php _e('Détails', 'booking-manager'); ?></a>
                </td>
            </tr>
            <?php endforeach; endif; ?>
        </tbody>
    </table>
</div>
