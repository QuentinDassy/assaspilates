<?php if (!defined('ABSPATH')) exit; ?>
<div class="wrap bm-admin">
    <h1><?php echo $course ? __('Modifier le cours', 'booking-manager') : __('Nouveau cours', 'booking-manager'); ?></h1>

    <?php if (isset($_GET['saved'])): ?>
        <div class="notice notice-success"><p><?php _e('Cours enregistré avec succès.', 'booking-manager'); ?></p></div>
    <?php endif; ?>

    <form method="post" action="<?php echo admin_url('admin-post.php'); ?>">
        <?php wp_nonce_field('bm_save_course'); ?>
        <input type="hidden" name="action" value="bm_save_course">
        <input type="hidden" name="course_id" value="<?php echo esc_attr($course->id ?? 0); ?>">

        <div class="bm-form-grid">
            <div class="bm-form-main">
                <div class="postbox">
                    <div class="postbox-header"><h2><?php _e('Informations générales', 'booking-manager'); ?></h2></div>
                    <div class="inside">
                        <table class="form-table">
                            <tr>
                                <th><label for="title"><?php _e('Titre du cours *', 'booking-manager'); ?></label></th>
                                <td><input type="text" id="title" name="title" class="regular-text" required value="<?php echo esc_attr($course->title ?? ''); ?>"></td>
                            </tr>
                            <tr>
                                <th><label for="description"><?php _e('Description', 'booking-manager'); ?></label></th>
                                <td><?php
                                    wp_editor($course->description ?? '', 'description', [
                                        'textarea_name' => 'description',
                                        'media_buttons' => false,
                                        'textarea_rows' => 6,
                                    ]);
                                ?></td>
                            </tr>
                            <tr>
                                <th><label for="instructor"><?php _e('Intervenant', 'booking-manager'); ?></label></th>
                                <td><input type="text" id="instructor" name="instructor" class="regular-text" value="<?php echo esc_attr($course->instructor ?? ''); ?>"></td>
                            </tr>
                            <tr>
                                <th><label for="location"><?php _e('Lieu', 'booking-manager'); ?></label></th>
                                <td><input type="text" id="location" name="location" class="regular-text" value="<?php echo esc_attr($course->location ?? ''); ?>"></td>
                            </tr>
                        </table>
                    </div>
                </div>

                <div class="postbox">
                    <div class="postbox-header"><h2><?php _e('Dates & Horaires', 'booking-manager'); ?></h2></div>
                    <div class="inside">
                        <table class="form-table">
                            <tr>
                                <th><label for="start_datetime"><?php _e('Début *', 'booking-manager'); ?></label></th>
                                <td><input type="datetime-local" id="start_datetime" name="start_datetime" required value="<?php echo esc_attr(isset($course->start_datetime) ? date('Y-m-d\TH:i', strtotime($course->start_datetime)) : ''); ?>"></td>
                            </tr>
                            <tr>
                                <th><label for="end_datetime"><?php _e('Fin *', 'booking-manager'); ?></label></th>
                                <td><input type="datetime-local" id="end_datetime" name="end_datetime" required value="<?php echo esc_attr(isset($course->end_datetime) ? date('Y-m-d\TH:i', strtotime($course->end_datetime)) : ''); ?>"></td>
                            </tr>
                        </table>
                    </div>
                </div>
            </div>

            <div class="bm-form-sidebar">
                <div class="postbox">
                    <div class="postbox-header"><h2><?php _e('Publication', 'booking-manager'); ?></h2></div>
                    <div class="inside">
                        <p>
                            <label><?php _e('Statut', 'booking-manager'); ?></label><br>
                            <select name="status">
                                <option value="draft" <?php selected($course->status ?? 'draft', 'draft'); ?>><?php _e('Brouillon', 'booking-manager'); ?></option>
                                <option value="published" <?php selected($course->status ?? '', 'published'); ?>><?php _e('Publié', 'booking-manager'); ?></option>
                                <option value="cancelled" <?php selected($course->status ?? '', 'cancelled'); ?>><?php _e('Annulé', 'booking-manager'); ?></option>
                            </select>
                        </p>
                        <?php submit_button(__('Enregistrer', 'booking-manager')); ?>
                    </div>
                </div>

                <div class="postbox">
                    <div class="postbox-header"><h2><?php _e('Capacité & Tarif', 'booking-manager'); ?></h2></div>
                    <div class="inside">
                        <p>
                            <label for="max_capacity"><?php _e('Places max *', 'booking-manager'); ?></label><br>
                            <input type="number" id="max_capacity" name="max_capacity" min="1" class="small-text" value="<?php echo esc_attr($course->max_capacity ?? 10); ?>" required>
                        </p>
                        <p>
                            <label for="price"><?php _e('Prix (€) *', 'booking-manager'); ?></label><br>
                            <input type="number" id="price" name="price" min="0" step="0.01" class="small-text" value="<?php echo esc_attr($course->price ?? 0); ?>" required>
                        </p>
                        <p>
                            <label for="currency"><?php _e('Devise', 'booking-manager'); ?></label><br>
                            <select id="currency" name="currency">
                                <option value="EUR" <?php selected($course->currency ?? 'EUR', 'EUR'); ?>>EUR €</option>
                                <option value="USD" <?php selected($course->currency ?? '', 'USD'); ?>>USD $</option>
                                <option value="GBP" <?php selected($course->currency ?? '', 'GBP'); ?>>GBP £</option>
                            </select>
                        </p>
                    </div>
                </div>

                <?php if ($course): ?>
                <div class="postbox">
                    <div class="postbox-header"><h2><?php _e('Actions', 'booking-manager'); ?></h2></div>
                    <div class="inside">
                        <a href="<?php echo admin_url('admin.php?page=bm-bookings&course_id=' . $course->id); ?>" class="button">
                            <?php _e('Voir les réservations', 'booking-manager'); ?>
                        </a>
                        <?php if ($course->status !== 'cancelled'): ?>
                        <form method="post" action="<?php echo admin_url('admin-post.php'); ?>" style="margin-top:10px">
                            <?php wp_nonce_field('bm_cancel_course'); ?>
                            <input type="hidden" name="action" value="bm_cancel_course">
                            <input type="hidden" name="course_id" value="<?php echo $course->id; ?>">
                            <button type="submit" class="button bm-btn-danger" onclick="return confirm('<?php _e('Annuler ce cours et rembourser tous les participants ?', 'booking-manager'); ?>')">
                                <?php _e('Annuler le cours', 'booking-manager'); ?>
                            </button>
                        </form>
                        <?php endif; ?>
                        <form method="post" action="<?php echo admin_url('admin-post.php'); ?>" style="margin-top:10px">
                            <?php wp_nonce_field('bm_delete_course'); ?>
                            <input type="hidden" name="action" value="bm_delete_course">
                            <input type="hidden" name="course_id" value="<?php echo $course->id; ?>">
                            <button type="submit" class="button bm-btn-danger" onclick="return confirm('<?php _e('Supprimer définitivement ce cours ?', 'booking-manager'); ?>')">
                                <?php _e('Supprimer', 'booking-manager'); ?>
                            </button>
                        </form>
                    </div>
                </div>
                <?php endif; ?>
            </div>
        </div>
    </form>
</div>
