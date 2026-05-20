(function ($) {
    'use strict';

    var BM = {
        stripe: null,
        cardElement: null,
        currentCourseId: null,
        currentCourse: null,
        currentBookingId: null,
        paymentIntentClientSecret: null,

        init: function () {
            if (!window.bmConfig || !window.bmConfig.stripePublicKey) {
                console.warn('Booking Manager: Clé Stripe non configurée');
                return;
            }

            BM.stripe = Stripe(window.bmConfig.stripePublicKey);
            BM.bindEvents();
        },

        bindEvents: function () {
            // Ouvrir modal
            $(document).on('click', '.bm-open-booking', function () {
                var courseId = $(this).data('course-id');
                BM.openModal(courseId);
            });

            // Fermer modal
            $(document).on('click', '.bm-modal-overlay, .bm-modal-close, .bm-modal-close-btn', BM.closeModal);

            // Mise à jour total quand participants change
            $(document).on('input', '#bm-participants', BM.updateTotal);

            // Étape 1 → Paiement
            $(document).on('click', '#bm-btn-next', BM.goToPayment);

            // Retour étape 1
            $(document).on('click', '#bm-btn-back', BM.goBackToForm);

            // Paiement
            $(document).on('click', '#bm-btn-pay', BM.processPayment);

            // Retry
            $(document).on('click', '#bm-btn-retry', function () {
                BM.showStep('form');
            });
        },

        openModal: function (courseId) {
            BM.currentCourseId = courseId;
            BM.showModal();
            BM.showStep('loading');

            $.get(window.bmConfig.ajaxUrl, {
                action: 'get_course',
                course_id: courseId,
            }, function (res) {
                if (!res.success) {
                    BM.showError(res.data.message || window.bmConfig.i18n.error);
                    return;
                }

                BM.currentCourse = res.data;
                BM.renderFormStep();
                BM.showStep('form');
            }).fail(function () {
                BM.showError(window.bmConfig.i18n.error);
            });
        },

        renderFormStep: function () {
            var c = BM.currentCourse;
            var start = new Date(c.start_datetime);
            var end   = new Date(c.end_datetime);

            var dateStr = start.toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
            var timeStr = start.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})
                        + ' – '
                        + end.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});

            $('#bm-modal-course-title').text(c.title);

            var summary = '<p>📅 ' + dateStr + ' ' + timeStr + '</p>';
            if (c.location) summary += '<p>📍 ' + c.location + '</p>';
            if (c.instructor) summary += '<p>👤 ' + c.instructor + '</p>';
            summary += '<p><strong>Places disponibles : ' + c.spots_available + '</strong></p>';
            $('#bm-course-summary').html(summary);

            $('#bm-participants').attr('max', c.spots_available).val(1);
            BM.updateTotal();
        },

        updateTotal: function () {
            if (!BM.currentCourse) return;
            var qty   = parseInt($('#bm-participants').val()) || 1;
            var price = parseFloat(BM.currentCourse.price);
            var total = (price * qty).toFixed(2).replace('.', ',');
            var currency = BM.currentCourse.currency.toUpperCase();

            if (price > 0) {
                $('#bm-total-display').show().html(
                    'Total : <strong>' + total + ' ' + currency + '</strong>'
                    + (qty > 1 ? ' (' + qty + ' × ' + price.toFixed(2).replace('.', ',') + ' ' + currency + ')' : '')
                );
            }
        },

        goToPayment: function () {
            var firstName = $('#bm-first-name').val().trim();
            var lastName  = $('#bm-last-name').val().trim();
            var email     = $('#bm-email').val().trim();
            var phone     = $('#bm-phone').val().trim();
            var participants = parseInt($('#bm-participants').val()) || 1;

            if (!firstName || !lastName || !email) {
                alert('Veuillez remplir tous les champs obligatoires.');
                return;
            }

            BM.showStep('loading');

            $.post(window.bmConfig.ajaxUrl, {
                action: 'create_payment_intent',
                nonce: window.bmConfig.nonce,
                course_id: BM.currentCourseId,
                first_name: firstName,
                last_name: lastName,
                email: email,
                phone: phone,
                participants: participants,
            }, function (res) {
                if (!res.success) {
                    BM.showError(res.data.message || window.bmConfig.i18n.error);
                    return;
                }

                BM.currentBookingId = res.data.booking_id;
                BM.paymentIntentClientSecret = res.data.client_secret;

                // Résumé paiement
                var c = BM.currentCourse;
                var summary = '<p><strong>' + c.title + '</strong></p>';
                summary += '<p>' + participants + ' participant(s) × ' + parseFloat(c.price).toFixed(2).replace('.', ',') + ' €</p>';
                summary += '<p><strong>Total : ' + res.data.total + ' ' + res.data.currency + '</strong></p>';
                $('#bm-payment-summary').html(summary);

                // Initialiser Stripe Elements
                var elements = BM.stripe.elements();
                BM.cardElement = elements.create('card', {
                    style: {
                        base: {
                            fontSize: '16px',
                            color: '#374151',
                            '::placeholder': { color: '#9ca3af' },
                        },
                        invalid: { color: '#dc2626' },
                    },
                    hidePostalCode: true,
                });
                BM.cardElement.mount('#bm-card-element');
                BM.cardElement.on('change', function (e) {
                    $('#bm-card-errors').text(e.error ? e.error.message : '');
                });

                BM.showStep('payment');
            }).fail(function () {
                BM.showError(window.bmConfig.i18n.error);
            });
        },

        goBackToForm: function () {
            if (BM.cardElement) {
                BM.cardElement.unmount();
                BM.cardElement = null;
            }
            BM.showStep('form');
        },

        processPayment: function () {
            var $btn = $('#bm-btn-pay');
            $btn.prop('disabled', true).text(window.bmConfig.i18n.processing);
            $('#bm-card-errors').text('');

            BM.stripe.confirmCardPayment(BM.paymentIntentClientSecret, {
                payment_method: { card: BM.cardElement },
            }).then(function (result) {
                if (result.error) {
                    $('#bm-card-errors').text(result.error.message);
                    $btn.prop('disabled', false).text('Payer et confirmer');
                    return;
                }

                // Confirmer côté serveur
                $.post(window.bmConfig.ajaxUrl, {
                    action: 'confirm_booking',
                    nonce: window.bmConfig.nonce,
                    booking_id: BM.currentBookingId,
                    payment_intent_id: result.paymentIntent.id,
                }, function (res) {
                    if (!res.success) {
                        BM.showError(res.data.message || window.bmConfig.i18n.error);
                        return;
                    }

                    // Succès
                    var c = BM.currentCourse;
                    var detailsHtml = '<div class="bm-course-summary" style="text-align:left;">';
                    detailsHtml += '<p><strong>' + c.title + '</strong></p>';
                    if (c.start_datetime) {
                        var d = new Date(c.start_datetime);
                        detailsHtml += '<p>📅 ' + d.toLocaleDateString('fr-FR', {weekday:'long',day:'numeric',month:'long',year:'numeric'}) + '</p>';
                    }
                    if (c.location) detailsHtml += '<p>📍 ' + c.location + '</p>';
                    detailsHtml += '</div>';
                    detailsHtml += '<p style="color:#6b7280;font-size:.875rem;">Un email de confirmation vous a été envoyé.</p>';
                    $('#bm-success-details').html(detailsHtml);

                    BM.showStep('success');
                }).fail(function () {
                    BM.showError(window.bmConfig.i18n.error);
                });
            });
        },

        showModal: function () {
            $('#bm-booking-modal').show();
            $('body').css('overflow', 'hidden');
        },

        closeModal: function () {
            $('#bm-booking-modal').hide();
            $('body').css('overflow', '');

            // Reset
            BM.currentCourseId = null;
            BM.currentCourse = null;
            BM.currentBookingId = null;
            BM.paymentIntentClientSecret = null;
            if (BM.cardElement) {
                BM.cardElement.unmount();
                BM.cardElement = null;
            }

            // Vider les champs
            $('#bm-first-name, #bm-last-name, #bm-email, #bm-phone').val('');
            $('#bm-participants').val(1);
            $('#bm-card-errors').text('');
        },

        showStep: function (step) {
            $('#bm-step-form, #bm-step-payment, #bm-step-success, #bm-step-error, #bm-loading').hide();
            $('#bm-btn-next, #bm-btn-pay').prop('disabled', false);

            switch (step) {
                case 'form':    $('#bm-step-form').show(); break;
                case 'payment': $('#bm-step-payment').show(); break;
                case 'success': $('#bm-step-success').show(); break;
                case 'error':   $('#bm-step-error').show(); break;
                case 'loading': $('#bm-loading').show(); break;
            }
        },

        showError: function (message) {
            $('#bm-error-message').text(message);
            BM.showStep('error');
        },
    };

    $(document).ready(function () {
        BM.init();
    });

})(jQuery);
