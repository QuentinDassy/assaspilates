<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><style>
body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
.email-wrapper { max-width: 600px; margin: 0 auto; background: #fff; }
.email-header { background: #f59e0b; color: white; padding: 30px; text-align: center; }
.email-header h1 { margin: 0; font-size: 24px; }
.email-body { padding: 30px; }
.booking-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px; }
.booking-box p { margin: 8px 0; }
.btn { display: inline-block; background: #f59e0b; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; margin: 20px 0; font-weight: bold; }
.email-footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; }
</style></head>
<body>
<div class="email-wrapper">
    <div class="email-header">
        <h1>⏰ Rappel : cours demain</h1>
        <p><?php echo esc_html($site_name); ?></p>
    </div>
    <div class="email-body">
        <h2>Bonjour <?php echo esc_html($booking->first_name); ?>,</h2>
        <p>Nous vous rappelons que vous avez un cours prévu demain :</p>

        <div class="booking-box">
            <p><strong>📚 Cours :</strong> <?php echo esc_html($course->title); ?></p>
            <p><strong>📅 Date :</strong> <?php echo date_i18n('l d F Y \à H\hi', strtotime($course->start_datetime)); ?></p>
            <?php if ($course->location): ?><p><strong>📍 Lieu :</strong> <?php echo esc_html($course->location); ?></p><?php endif; ?>
            <?php if ($course->instructor): ?><p><strong>👤 Intervenant :</strong> <?php echo esc_html($course->instructor); ?></p><?php endif; ?>
        </div>

        <a href="<?php echo esc_url($manage_url); ?>" class="btn">Voir ma réservation</a>
    </div>
    <div class="email-footer">
        <p><?php echo esc_html($site_name); ?></p>
    </div>
</div>
</body>
</html>
