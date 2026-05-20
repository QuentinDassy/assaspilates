<?php if (!defined('ABSPATH')) exit; ?>
<div class="bm-manage-wrapper">

    <?php if ($action === 'manage' && $token): ?>

    <div id="bm-manage-area">
        <div class="bm-loading-state">
            <div class="bm-spinner"></div>
            <p><?php _e('Chargement de votre réservation...', 'booking-manager'); ?></p>
        </div>
    </div>

    <script>
    document.addEventListener('DOMContentLoaded', function() {
        var token = '<?php echo esc_js($token); ?>';
        var ajaxUrl = '<?php echo admin_url('admin-ajax.php'); ?>';
        var nonce = '<?php echo wp_create_nonce('bm_nonce'); ?>';

        fetch(ajaxUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: new URLSearchParams({action: 'get_booking_by_token', nonce: nonce, token: token})
        })
        .then(r => r.json())
        .then(function(res) {
            var area = document.getElementById('bm-manage-area');
            if (!res.success) {
                area.innerHTML = '<div class="bm-alert bm-alert-error"><?php _e('Réservation introuvable ou lien invalide.', 'booking-manager'); ?></div>';
                return;
            }
            var b = res.data.booking;
            var c = res.data.course;
            var canCancel = ['confirmed','pending'].includes(b.status);

            var html = '<div class="bm-booking-card">';
            html += '<h2><?php _e('Ma réservation', 'booking-manager'); ?> #' + b.id + '</h2>';
            html += '<span class="bm-status bm-status-' + b.status + '">' + b.status + '</span>';
            html += '<hr>';
            if (c) {
                html += '<h3>' + (c.title || '') + '</h3>';
                html += '<ul class="bm-meta-list">';
                html += '<li>📅 ' + new Date(c.start_datetime).toLocaleDateString('fr-FR', {weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}) + '</li>';
                if (c.location) html += '<li>📍 ' + c.location + '</li>';
                if (c.instructor) html += '<li>👤 ' + c.instructor + '</li>';
                html += '</ul>';
            }
            html += '<p><strong><?php _e('Participants :', 'booking-manager'); ?></strong> ' + b.participants + '</p>';
            html += '<p><strong><?php _e('Montant payé :', 'booking-manager'); ?></strong> ' + parseFloat(b.total_amount).toFixed(2).replace('.',',') + ' €</p>';

            if (canCancel) {
                html += '<hr><div class="bm-cancel-section">';
                html += '<h3><?php _e('Annuler ma réservation', 'booking-manager'); ?></h3>';
                html += '<p class="bm-info"><?php _e('Si vous annulez, vous serez remboursé(e) sous 5 à 10 jours ouvrés.', 'booking-manager'); ?></p>';
                html += '<div class="bm-form-group"><label><?php _e('Raison (optionnel)', 'booking-manager'); ?></label>';
                html += '<textarea id="bm-cancel-reason" rows="3" style="width:100%"></textarea></div>';
                html += '<button id="bm-cancel-btn" class="bm-btn bm-btn-danger"><?php _e('Annuler et obtenir un remboursement', 'booking-manager'); ?></button>';
                html += '</div>';
            }

            html += '</div>';
            area.innerHTML = html;

            if (canCancel) {
                document.getElementById('bm-cancel-btn').addEventListener('click', function() {
                    if (!confirm('<?php _e('Êtes-vous sûr de vouloir annuler votre réservation ?', 'booking-manager'); ?>')) return;
                    var reason = document.getElementById('bm-cancel-reason').value;
                    this.disabled = true;
                    this.textContent = '<?php _e('Annulation en cours...', 'booking-manager'); ?>';

                    fetch(ajaxUrl, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                        body: new URLSearchParams({action: 'cancel_booking', nonce: nonce, token: token, reason: reason})
                    })
                    .then(r => r.json())
                    .then(function(res) {
                        if (res.success) {
                            area.innerHTML = '<div class="bm-alert bm-alert-success"><p>✅ ' + res.data.message + '</p></div>';
                        } else {
                            area.innerHTML = '<div class="bm-alert bm-alert-error"><p>' + res.data.message + '</p></div>';
                        }
                    });
                });
            }
        })
        .catch(function() {
            document.getElementById('bm-manage-area').innerHTML = '<div class="bm-alert bm-alert-error"><?php _e('Erreur de connexion.', 'booking-manager'); ?></div>';
        });
    });
    </script>

    <?php else: ?>
        <div class="bm-alert bm-alert-error"><?php _e('Lien de gestion invalide.', 'booking-manager'); ?></div>
    <?php endif; ?>

</div>
