<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><style>
body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
.email-wrapper { max-width: 600px; margin: 0 auto; background: #fff; }
.email-header { background: #2563eb; color: white; padding: 30px; text-align: center; }
.email-header h1 { margin: 0; font-size: 24px; }
.email-body { padding: 30px; }
.email-body h2 { color: #1e3a8a; }
.booking-box { background: #f0f7ff; border-left: 4px solid #2563eb; padding: 20px; margin: 20px 0; border-radius: 4px; }
.booking-box p { margin: 8px 0; }
.btn { display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; margin: 20px 0; font-weight: bold; }
.email-footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; }
</style></head>
<body>
<div class="email-wrapper">
    <div class="email-header">
        <h1>✅ Réservation confirmée</h1>
        <p><?php echo esc_html($site_name); ?></p>
    </div>
    <div class="email-body">
        <h2>Bonjour <?php echo esc_html($booking->first_name); ?>,</h2>
        <p>Votre réservation a été confirmée avec succès. Voici le récapitulatif :</p>

        <div class="booking-box">
            <p><strong>📚 Cours :</strong> <?php echo esc_html($course->title); ?></p>
            <p><strong>📅 Date :</strong> <?php echo date_i18n('l d F Y \à H\hi', strtotime($course->start_datetime)); ?></p>
            <p><strong>⏱ Durée :</strong> <?php echo date_i18n('H\hi', strtotime($course->start_datetime)); ?> – <?php echo date_i18n('H\hi', strtotime($course->end_datetime)); ?></p>
            <?php if ($course->location): ?><p><strong>📍 Lieu :</strong> <?php echo esc_html($course->location); ?></p><?php endif; ?>
            <?php if ($course->instructor): ?><p><strong>👤 Intervenant :</strong> <?php echo esc_html($course->instructor); ?></p><?php endif; ?>
            <p><strong>👥 Participants :</strong> <?php echo $booking->participants; ?></p>
            <p><strong>💳 Montant payé :</strong> <?php echo number_format($booking->total_amount, 2, ',', ' '); ?> €</p>
        </div>

        <p>Besoin de modifier ou annuler votre réservation ?</p>
        <a href="<?php echo esc_url($manage_url); ?>" class="btn">Gérer ma réservation</a>

        <p style="color:#888;font-size:13px;">Ce lien est personnel et sécurisé. Ne le partagez pas.</p>
    </div>
    <div class="email-footer">
        <p><?php echo esc_html($site_name); ?> — Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
    </div>
</div>
</body>
</html>
