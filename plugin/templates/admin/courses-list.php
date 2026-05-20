<?php if (!defined('ABSPATH')) exit; ?>
<div class="wrap bm-admin">
    <h1 class="wp-heading-inline"><?php _e('Cours', 'booking-manager'); ?></h1>
    <a href="<?php echo admin_url('admin.php?page=bm-courses&action=new'); ?>" class="page-title-action"><?php _e('Ajouter un cours', 'booking-manager'); ?></a>

    <?php if (isset($_GET['deleted'])): ?>
        <div class="notice notice-success"><p><?php _e('Cours supprimé.', 'booking-manager'); ?></p></div>
    <?php endif; ?>
    <?php if (isset($_GET['cancelled'])): ?>
        <div class="notice notice-success"><p><?php _e('Cours annulé. Les participants ont été notifiés.', 'booking-manager'); ?></p></div>
    <?php endif; ?>

    <table class="wp-list-table widefat fixed striped">
        <thead>
            <tr>
                <th><?php _e('Titre', 'booking-manager'); ?></th>
                <th><?php _e('Intervenant', 'booking-manager'); ?></th>
                <th><?php _e('Date de début', 'booking-manager'); ?></th>
                <th><?php _e('Durée', 'booking-manager'); ?></th>
                <th><?php _e('Places', 'booking-manager'); ?></th>
                <th><?php _e('Prix', 'booking-manager'); ?></th>
                <th><?php _e('Statut', 'booking-manager'); ?></th>
                <th><?php _e('Actions', 'booking-manager'); ?></th>
            </tr>
        </thead>
        <tbody>
            <?php if (empty($courses)): ?>
            <tr><td colspan="8" style="text-align:center;padding:20px;">
                <?php _e('Aucun cours. ', 'booking-manager'); ?>
                <a href="<?php echo admin_url('admin.php?page=bm-courses&action=new'); ?>"><?php _e('Créer votre premier cours', 'booking-manager'); ?></a>
            </td></tr>
            <?php else: foreach ($courses as $course):
                $spots = (new BM_Course())->get_spots_available($course->id);
                $start = strtotime($course->start_datetime);
                $end   = strtotime($course->end_datetime);
                $duration_min = ($end - $start) / 60;
            ?>
            <tr>
                <td><strong><a href="<?php echo admin_url('admin.php?page=bm-courses&action=edit&course_id=' . $course->id); ?>"><?php echo esc_html($course->title); ?></a></strong></td>
                <td><?php echo esc_html($course->instructor ?: '—'); ?></td>
                <td><?php echo esc_html(date_i18n('d/m/Y H:i', $start)); ?></td>
                <td><?php
                    if ($duration_min < 60) echo $duration_min . ' min';
                    else echo number_format($duration_min / 60, 1) . ' h';
                ?></td>
                <td>
                    <span class="bm-badge <?php echo $spots === 0 ? 'bm-badge-danger' : ($spots <= 3 ? 'bm-badge-warning' : 'bm-badge-success'); ?>">
                        <?php echo $spots . '/' . $course->max_capacity; ?>
                    </span>
                </td>
                <td><?php echo number_format($course->price, 2, ',', ' ') . ' ' . strtoupper($course->currency); ?></td>
                <td><span class="bm-status bm-status-<?php echo esc_attr($course->status); ?>"><?php echo esc_html($course->status); ?></span></td>
                <td>
                    <a href="<?php echo admin_url('admin.php?page=bm-courses&action=edit&course_id=' . $course->id); ?>" class="button button-small"><?php _e('Modifier', 'booking-manager'); ?></a>
                    <a href="<?php echo admin_url('admin.php?page=bm-bookings&course_id=' . $course->id); ?>" class="button button-small"><?php _e('Réservations', 'booking-manager'); ?></a>
                </td>
            </tr>
            <?php endforeach; endif; ?>
        </tbody>
    </table>
</div>
