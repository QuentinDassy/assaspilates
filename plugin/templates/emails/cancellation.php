<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><style>
body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
.email-wrapper { max-width: 600px; margin: 0 auto; background: #fff; }
.email-header { background: #dc2626; color: white; padding: 30px; text-align: center; }
.email-header h1 { margin: 0; font-size: 24px; }
.email-body { padding: 30px; }
.booking-box { background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 4px; }
.booking-box p { margin: 8px 0; }
.refund-box { background: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0; border-radius: 4px; }
.email-footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; }
</style></head>
<body>
<div class="email-wrapper">
    <div class="email-header">
        <h1>❌ Réservation annulée</h1>
        <p><?php echo esc_html($site_name); ?></p>
    </div>
    <div class="email-body">
        <h2>Bonjour <?php echo esc_html($booking->first_name); ?>,</h2>
        <p>Votre réservation a été annulée.</p>

        <?php if ($course): ?>
        <div class="booking-box">
            <p><strong>📚 Cours :</strong> <?php echo esc_html($course->title); ?></p>
            <p><strong>📅 Date :</strong> <?php echo date_i18n('l d F Y \à H\hi', strtotime($course->start_datetime)); ?></p>
        </div>
        <?php endif; ?>

        <?php if ($refunded && $booking->total_amount > 0): ?>
        <div class="refund-box">
            <p><strong>💰 Remboursement :</strong> Un remboursement de <?php echo number_format($booking->total_amount, 2, ',', ' '); ?> € a été initié sur votre moyen de paiement. Comptez 5 à 10 jours ouvrés.</p>
        </div>
        <?php endif; ?>

        <?php if ($booking->cancellation_reason): ?>
        <p><strong>Raison :</strong> <?php echo esc_html($booking->cancellation_reason); ?></p>
        <?php endif; ?>

        <p>Pour toute question, contactez-nous à <?php echo esc_html(get_option('admin_email')); ?></p>
    </div>
    <div class="email-footer">
        <p><?php echo esc_html($site_name); ?></p>
    </div>
</div>
</body>
</html>
