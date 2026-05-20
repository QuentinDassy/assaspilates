<?php if (!defined('ABSPATH')) exit; ?>

<div class="bm-courses-wrapper">

    <?php if (empty($courses)): ?>
        <p class="bm-no-courses"><?php _e('Aucun cours disponible pour le moment.', 'booking-manager'); ?></p>
    <?php else: ?>

    <div class="bm-courses-grid">
        <?php foreach ($courses as $course): ?>
        <div class="bm-course-card <?php echo $course->spots_available === 0 ? 'bm-course-full' : ''; ?>">
            <div class="bm-course-header">
                <h3 class="bm-course-title"><?php echo esc_html($course->title); ?></h3>
                <?php if ($course->spots_available === 0): ?>
                    <span class="bm-badge bm-badge-danger"><?php _e('Complet', 'booking-manager'); ?></span>
                <?php elseif ($course->spots_available <= 3): ?>
                    <span class="bm-badge bm-badge-warning"><?php printf(__('%d place(s) restante(s)', 'booking-manager'), $course->spots_available); ?></span>
                <?php else: ?>
                    <span class="bm-badge bm-badge-success"><?php printf(__('%d places disponibles', 'booking-manager'), $course->spots_available); ?></span>
                <?php endif; ?>
            </div>

            <div class="bm-course-body">
                <?php if ($course->description): ?>
                    <p class="bm-course-desc"><?php echo wp_kses_post($course->description); ?></p>
                <?php endif; ?>

                <ul class="bm-course-meta">
                    <li>
                        <span class="bm-icon">📅</span>
                        <?php echo date_i18n('l d F Y', strtotime($course->start_datetime)); ?>
                        <?php _e('de', 'booking-manager'); ?>
                        <?php echo date_i18n('H:i', strtotime($course->start_datetime)); ?>
                        <?php _e('à', 'booking-manager'); ?>
                        <?php echo date_i18n('H:i', strtotime($course->end_datetime)); ?>
                    </li>
                    <?php if ($course->instructor): ?>
                    <li><span class="bm-icon">👤</span> <?php echo esc_html($course->instructor); ?></li>
                    <?php endif; ?>
                    <?php if ($course->location): ?>
                    <li><span class="bm-icon">📍</span> <?php echo esc_html($course->location); ?></li>
                    <?php endif; ?>
                </ul>
            </div>

            <div class="bm-course-footer">
                <div class="bm-course-price"><?php echo number_format($course->price, 2, ',', ' ') . ' ' . strtoupper($course->currency); ?></div>
                <?php if ($course->spots_available > 0): ?>
                    <button class="bm-btn bm-btn-primary bm-open-booking" data-course-id="<?php echo $course->id; ?>">
                        <?php _e('Réserver', 'booking-manager'); ?>
                    </button>
                <?php else: ?>
                    <button class="bm-btn bm-btn-disabled" disabled><?php _e('Complet', 'booking-manager'); ?></button>
                <?php endif; ?>
            </div>
        </div>
        <?php endforeach; ?>
    </div>

    <?php endif; ?>
</div>

<!-- Modal de réservation -->
<div id="bm-booking-modal" class="bm-modal" style="display:none;">
    <div class="bm-modal-overlay"></div>
    <div class="bm-modal-content">
        <button class="bm-modal-close">✕</button>

        <!-- Étape 1: Formulaire -->
        <div id="bm-step-form">
            <h2 id="bm-modal-course-title"></h2>
            <div id="bm-course-summary" class="bm-course-summary"></div>

            <div class="bm-form-group">
                <label><?php _e('Prénom *', 'booking-manager'); ?></label>
                <input type="text" id="bm-first-name" required>
            </div>
            <div class="bm-form-group">
                <label><?php _e('Nom *', 'booking-manager'); ?></label>
                <input type="text" id="bm-last-name" required>
            </div>
            <div class="bm-form-group">
                <label><?php _e('Email *', 'booking-manager'); ?></label>
                <input type="email" id="bm-email" required>
            </div>
            <div class="bm-form-group">
                <label><?php _e('Téléphone', 'booking-manager'); ?></label>
                <input type="tel" id="bm-phone">
            </div>
            <div class="bm-form-group">
                <label><?php _e('Nombre de participants *', 'booking-manager'); ?></label>
                <input type="number" id="bm-participants" min="1" value="1">
            </div>
            <div id="bm-total-display" class="bm-total-display" style="display:none;"></div>
            <button id="bm-btn-next" class="bm-btn bm-btn-primary bm-btn-full"><?php _e('Continuer vers le paiement', 'booking-manager'); ?></button>
        </div>

        <!-- Étape 2: Paiement Stripe -->
        <div id="bm-step-payment" style="display:none;">
            <h2><?php _e('Paiement sécurisé', 'booking-manager'); ?></h2>
            <div id="bm-payment-summary" class="bm-course-summary"></div>
            <div id="bm-card-element" class="bm-card-element"></div>
            <div id="bm-card-errors" class="bm-error-message" role="alert"></div>
            <button id="bm-btn-pay" class="bm-btn bm-btn-primary bm-btn-full"><?php _e('Payer et confirmer', 'booking-manager'); ?></button>
            <button id="bm-btn-back" class="bm-btn bm-btn-link"><?php _e('← Retour', 'booking-manager'); ?></button>
        </div>

        <!-- Étape 3: Confirmation -->
        <div id="bm-step-success" style="display:none;">
            <div class="bm-success-icon">✅</div>
            <h2><?php _e('Réservation confirmée !', 'booking-manager'); ?></h2>
            <p><?php _e('Un email de confirmation vous a été envoyé.', 'booking-manager'); ?></p>
            <div id="bm-success-details"></div>
            <button class="bm-btn bm-btn-primary bm-modal-close-btn"><?php _e('Fermer', 'booking-manager'); ?></button>
        </div>

        <div id="bm-loading" class="bm-loading" style="display:none;">
            <div class="bm-spinner"></div>
            <p><?php _e('Traitement en cours...', 'booking-manager'); ?></p>
        </div>

        <div id="bm-step-error" style="display:none;">
            <div class="bm-error-icon">❌</div>
            <h2><?php _e('Une erreur est survenue', 'booking-manager'); ?></h2>
            <p id="bm-error-message"></p>
            <button id="bm-btn-retry" class="bm-btn bm-btn-primary"><?php _e('Réessayer', 'booking-manager'); ?></button>
        </div>
    </div>
</div>
