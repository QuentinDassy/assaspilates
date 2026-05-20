<?php if (!defined('ABSPATH')) exit; ?>
<div class="wrap bm-admin">
    <h1><?php _e('Paramètres', 'booking-manager'); ?></h1>

    <?php if (isset($_GET['saved'])): ?>
        <div class="notice notice-success"><p><?php _e('Paramètres enregistrés.', 'booking-manager'); ?></p></div>
    <?php endif; ?>

    <form method="post" action="<?php echo admin_url('admin-post.php'); ?>">
        <?php wp_nonce_field('bm_save_settings'); ?>
        <input type="hidden" name="action" value="bm_save_settings">

        <h2 class="title"><?php _e('Stripe', 'booking-manager'); ?></h2>
        <table class="form-table">
            <tr>
                <th><?php _e('Mode test', 'booking-manager'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="stripe_test_mode" value="1" <?php checked(get_option('bm_stripe_test_mode', '1'), '1'); ?>>
                        <?php _e('Activer le mode test Stripe', 'booking-manager'); ?>
                    </label>
                    <p class="description"><?php _e('En mode test, utilisez les clés de test Stripe.', 'booking-manager'); ?></p>
                </td>
            </tr>
            <tr>
                <th><?php _e('Clé publique (test)', 'booking-manager'); ?></th>
                <td><input type="text" name="stripe_test_public_key" class="regular-text" value="<?php echo esc_attr(get_option('bm_stripe_test_public_key', '')); ?>" placeholder="pk_test_..."></td>
            </tr>
            <tr>
                <th><?php _e('Clé secrète (test)', 'booking-manager'); ?></th>
                <td><input type="password" name="stripe_test_secret_key" class="regular-text" value="<?php echo esc_attr(get_option('bm_stripe_test_secret_key', '')); ?>" placeholder="sk_test_..."></td>
            </tr>
            <tr>
                <th><?php _e('Clé publique (production)', 'booking-manager'); ?></th>
                <td><input type="text" name="stripe_public_key" class="regular-text" value="<?php echo esc_attr(get_option('bm_stripe_public_key', '')); ?>" placeholder="pk_live_..."></td>
            </tr>
            <tr>
                <th><?php _e('Clé secrète (production)', 'booking-manager'); ?></th>
                <td><input type="password" name="stripe_secret_key" class="regular-text" value="<?php echo esc_attr(get_option('bm_stripe_secret_key', '')); ?>" placeholder="sk_live_..."></td>
            </tr>
            <tr>
                <th><?php _e('Webhook secret', 'booking-manager'); ?></th>
                <td>
                    <input type="password" name="stripe_webhook_secret" class="regular-text" value="<?php echo esc_attr(get_option('bm_stripe_webhook_secret', '')); ?>" placeholder="whsec_...">
                    <p class="description">
                        <?php _e('URL de votre webhook Stripe :', 'booking-manager'); ?>
                        <code><?php echo esc_html(rest_url('booking-manager/v1/webhook')); ?></code>
                    </p>
                </td>
            </tr>
        </table>

        <h2 class="title"><?php _e('Annulations', 'booking-manager'); ?></h2>
        <table class="form-table">
            <tr>
                <th><?php _e('Délai minimum d\'annulation', 'booking-manager'); ?></th>
                <td>
                    <input type="number" name="cancellation_delay_hours" min="0" class="small-text" value="<?php echo esc_attr(get_option('bm_cancellation_delay_hours', 24)); ?>">
                    <?php _e('heures avant le cours', 'booking-manager'); ?>
                    <p class="description"><?php _e('Les clients ne pourront pas annuler moins de X heures avant le début du cours.', 'booking-manager'); ?></p>
                </td>
            </tr>
        </table>

        <h2 class="title"><?php _e('Emails', 'booking-manager'); ?></h2>
        <table class="form-table">
            <tr>
                <th><?php _e('Nom expéditeur', 'booking-manager'); ?></th>
                <td><input type="text" name="email_sender_name" class="regular-text" value="<?php echo esc_attr(get_option('bm_email_sender_name', get_bloginfo('name'))); ?>"></td>
            </tr>
            <tr>
                <th><?php _e('Email expéditeur', 'booking-manager'); ?></th>
                <td><input type="email" name="email_sender_email" class="regular-text" value="<?php echo esc_attr(get_option('bm_email_sender_email', get_option('admin_email'))); ?>"></td>
            </tr>
            <tr>
                <th><?php _e('Rappel avant cours', 'booking-manager'); ?></th>
                <td>
                    <input type="number" name="email_reminder_hours" min="1" class="small-text" value="<?php echo esc_attr(get_option('bm_email_reminder_hours', 24)); ?>">
                    <?php _e('heures avant le cours', 'booking-manager'); ?>
                </td>
            </tr>
        </table>

        <?php submit_button(__('Enregistrer les paramètres', 'booking-manager')); ?>
    </form>
</div>
