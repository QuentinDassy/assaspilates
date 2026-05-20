<?php if (!defined('ABSPATH')) exit; ?>
<div class="wrap bm-admin">
    <h1>
        <a href="<?php echo admin_url('admin.php?page=bm-bookings'); ?>"><?php _e('Réservations', 'booking-manager'); ?></a>
        → <?php _e('Réservation', 'booking-manager'); ?> #<?php echo $booking->id; ?>
    </h1>

    <?php if (!$booking): ?>
        <p><?php _e('Réservation introuvable.', 'booking-manager'); ?></p>
        <?php return; endif; ?>

    <div class="bm-detail-grid">
        <div class="bm-detail-main">
            <div class="postbox">
                <div class="postbox-header"><h2><?php _e('Informations client', 'booking-manager'); ?></h2></div>
                <div class="inside">
                    <table class="form-table">
                        <tr><th><?php _e('Nom', 'booking-manager'); ?></th><td><?php echo esc_html($booking->first_name . ' ' . $booking->last_name); ?></td></tr>
                        <tr><th><?php _e('Email', 'booking-manager'); ?></th><td><a href="mailto:<?php echo esc_attr($booking->email); ?>"><?php echo esc_html($booking->email); ?></a></td></tr>
                        <tr><th><?php _e('Téléphone', 'booking-manager'); ?></th><td><?php echo esc_html($booking->phone ?: '—'); ?></td></tr>
                        <tr><th><?php _e('Participants', 'booking-manager'); ?></th><td><?php echo esc_html($booking->participants); ?></td></tr>
                    </table>
                </div>
            </div>

            <?php if ($course): ?>
            <div class="postbox">
                <div class="postbox-header"><h2><?php _e('Cours réservé', 'booking-manager'); ?></h2></div>
                <div class="inside">
                    <table class="form-table">
                        <tr><th><?php _e('Cours', 'booking-manager'); ?></th><td><?php echo esc_html($course->title); ?></td></tr>
                        <tr><th><?php _e('Date', 'booking-manager'); ?></th><td><?php echo date_i18n('d/m/Y H:i', strtotime($course->start_datetime)); ?></td></tr>
                        <tr><th><?php _e('Lieu', 'booking-manager'); ?></th><td><?php echo esc_html($course->location ?: '—'); ?></td></tr>
                        <tr><th><?php _e('Intervenant', 'booking-manager'); ?></th><td><?php echo esc_html($course->instructor ?: '—'); ?></td></tr>
                    </table>
                </div>
            </div>
            <?php endif; ?>

            <?php if ($booking->stripe_payment_intent_id): ?>
            <div class="postbox">
                <div class="postbox-header"><h2><?php _e('Paiement Stripe', 'booking-manager'); ?></h2></div>
                <div class="inside">
                    <table class="form-table">
                        <tr><th><?php _e('Payment Intent', 'booking-manager'); ?></th><td><code><?php echo esc_html($booking->stripe_payment_intent_id); ?></code></td></tr>
                        <tr><th><?php _e('Montant', 'booking-manager'); ?></th><td><?php echo number_format($booking->total_amount, 2, ',', ' '); ?> €</td></tr>
                    </table>
                </div>
            </div>
            <?php endif; ?>

            <?php if ($booking->cancellation_reason): ?>
            <div class="postbox">
                <div class="postbox-header"><h2><?php _e('Annulation', 'booking-manager'); ?></h2></div>
                <div class="inside">
                    <p><strong><?php _e('Raison :', 'booking-manager'); ?></strong> <?php echo esc_html($booking->cancellation_reason); ?></p>
                    <p><strong><?php _e('Date :', 'booking-manager'); ?></strong> <?php echo date_i18n('d/m/Y H:i', strtotime($booking->cancelled_at)); ?></p>
                </div>
            </div>
            <?php endif; ?>
        </div>

        <div class="bm-detail-sidebar">
            <div class="postbox">
                <div class="postbox-header"><h2><?php _e('Statut', 'booking-manager'); ?></h2></div>
                <div class="inside">
                    <p><span class="bm-status bm-status-<?php echo esc_attr($booking->status); ?> bm-status-large"><?php echo esc_html($booking->status); ?></span></p>
                    <p><strong><?php _e('Créée le :', 'booking-manager'); ?></strong><br><?php echo date_i18n('d/m/Y H:i', strtotime($booking->created_at)); ?></p>
                </div>
            </div>

            <?php if (in_array($booking->status, ['confirmed', 'pending'])): ?>
            <div class="postbox">
                <div class="postbox-header"><h2><?php _e('Actions', 'booking-manager'); ?></h2></div>
                <div class="inside">
                    <form method="post" action="<?php echo admin_url('admin-post.php'); ?>">
                        <?php wp_nonce_field('bm_cancel_booking'); ?>
                        <input type="hidden" name="action" value="bm_cancel_booking">
                        <input type="hidden" name="booking_id" value="<?php echo $booking->id; ?>">
                        <p>
                            <label>
                                <input type="checkbox" name="refund" value="1" checked>
                                <?php _e('Rembourser via Stripe', 'booking-manager'); ?>
                            </label>
                        </p>
                        <button type="submit" class="button bm-btn-danger" onclick="return confirm('<?php _e('Annuler cette réservation ?', 'booking-manager'); ?>')">
                            <?php _e('Annuler la réservation', 'booking-manager'); ?>
                        </button>
                    </form>
                </div>
            </div>
            <?php endif; ?>
        </div>
    </div>
</div>
