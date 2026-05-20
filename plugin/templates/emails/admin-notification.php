<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><style>
body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
.email-wrapper { max-width: 600px; margin: 0 auto; background: #fff; }
.email-header { background: #1e3a8a; color: white; padding: 30px; text-align: center; }
.email-body { padding: 30px; }
.info-box { background: #f0f7ff; border-left: 4px solid #2563eb; padding: 20px; margin: 20px 0; border-radius: 4px; }
.info-box p { margin: 8px 0; }
.btn { display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; margin: 20px 0; font-weight: bold; }
.email-footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; }
</style></head>
<body>
<div class="email-wrapper">
    <div class="email-header">
        <h1>🔔 Nouvelle réservation</h1>
    </div>
    <div class="email-body">
        <h2>Nouvelle réservation reçue</h2>

        <div class="info-box">
            <p><strong>Client :</strong> <?php echo esc_html($booking->first_name . ' ' . $booking->last_name); ?></p>
            <p><strong>Email :</strong> <?php echo esc_html($booking->email); ?></p>
            <p><strong>Téléphone :</strong> <?php echo esc_html($booking->phone ?: '—'); ?></p>
            <p><strong>Participants :</strong> <?php echo $booking->participants; ?></p>
            <p><strong>Montant :</strong> <?php echo number_format($booking->total_amount, 2, ',', ' '); ?> €</p>
        </div>

        <div class="info-box">
            <p><strong>Cours :</strong> <?php echo esc_html($course->title); ?></p>
            <p><strong>Date :</strong> <?php echo date_i18n('l d F Y \à H\hi', strtotime($course->start_datetime)); ?></p>
            <?php if ($course->location): ?><p><strong>Lieu :</strong> <?php echo esc_html($course->location); ?></p><?php endif; ?>
        </div>

        <a href="<?php echo esc_url($admin_url); ?>" class="btn">Voir dans l'administration</a>
    </div>
    <div class="email-footer">
        <p>Notification automatique</p>
    </div>
</div>
</body>
</html>
