<?php if (!defined('ABSPATH')) exit; ?>
<div class="wrap bm-admin">
    <h1><?php _e('Tableau de bord Réservations', 'booking-manager'); ?></h1>

    <div class="bm-stats-grid">
        <div class="bm-stat-card">
            <span class="bm-stat-icon dashicons dashicons-calendar-alt"></span>
            <div class="bm-stat-content">
                <h3><?php echo esc_html($stats['upcoming_courses']); ?></h3>
                <p><?php _e('Cours à venir', 'booking-manager'); ?></p>
            </div>
        </div>
        <div class="bm-stat-card">
            <span class="bm-stat-icon dashicons dashicons-groups"></span>
            <div class="bm-stat-content">
                <h3><?php echo esc_html($stats['total_bookings']); ?></h3>
                <p><?php _e('Réservations confirmées', 'booking-manager'); ?></p>
            </div>
        </div>
        <div class="bm-stat-card bm-stat-revenue">
            <span class="bm-stat-icon dashicons dashicons-money-alt"></span>
            <div class="bm-stat-content">
                <h3><?php echo number_format($stats['revenue'], 2, ',', ' '); ?> €</h3>
                <p><?php _e('Chiffre d\'affaires', 'booking-manager'); ?></p>
            </div>
        </div>
        <div class="bm-stat-card">
            <span class="bm-stat-icon dashicons dashicons-portfolio"></span>
            <div class="bm-stat-content">
                <h3><?php echo esc_html($stats['total_courses']); ?></h3>
                <p><?php _e('Cours publiés', 'booking-manager'); ?></p>
            </div>
        </div>
    </div>

    <div class="bm-dashboard-grid">
        <div class="bm-panel">
            <div class="bm-panel-header">
                <h2><?php _e('Prochains cours', 'booking-manager'); ?></h2>
                <a href="<?php echo admin_url('admin.php?page=bm-courses&action=new'); ?>" class="button button-primary">
                    <?php _e('+ Nouveau cours', 'booking-manager'); ?>
                </a>
            </div>
            <?php if ($upcoming): ?>
            <table class="widefat striped">
                <thead>
                    <tr>
                        <th><?php _e('Cours', 'booking-manager'); ?></th>
                        <th><?php _e('Date', 'booking-manager'); ?></th>
                        <th><?php _e('Places', 'booking-manager'); ?></th>
                        <th><?php _e('Prix', 'booking-manager'); ?></th>
                        <th><?php _e('Actions', 'booking-manager'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($upcoming as $course):
                        $spots = (new BM_Course())->get_spots_available($course->id);
                    ?>
                    <tr>
                        <td><strong><?php echo esc_html($course->title); ?></strong></td>
                        <td><?php echo esc_html(date_i18n('d/m/Y H:i', strtotime($course->start_datetime))); ?></td>
                        <td>
                            <span class="bm-badge <?php echo $spots === 0 ? 'bm-badge-danger' : ($spots <= 3 ? 'bm-badge-warning' : 'bm-badge-success'); ?>">
                                <?php echo $spots; ?>/<?php echo $course->max_capacity; ?>
                            </span>
                        </td>
                        <td><?php echo number_format($course->price, 2, ',', ' '); ?> €</td>
                        <td>
                            <a href="<?php echo admin_url('admin.php?page=bm-bookings&course_id=' . $course->id); ?>" class="button button-small">
                                <?php _e('Réservations', 'booking-manager'); ?>
                            </a>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <?php else: ?>
                <p class="bm-empty"><?php _e('Aucun cours à venir. ', 'booking-manager'); ?>
                    <a href="<?php echo admin_url('admin.php?page=bm-courses&action=new'); ?>"><?php _e('Créer un cours', 'booking-manager'); ?></a>
                </p>
            <?php endif; ?>
        </div>

        <div class="bm-panel">
            <div class="bm-panel-header">
                <h2><?php _e('Dernières réservations', 'booking-manager'); ?></h2>
                <a href="<?php echo admin_url('admin.php?page=bm-bookings'); ?>" class="button"><?php _e('Tout voir', 'booking-manager'); ?></a>
            </div>
            <?php if ($recent_bookings): ?>
            <table class="widefat striped">
                <thead>
                    <tr>
                        <th><?php _e('Client', 'booking-manager'); ?></th>
                        <th><?php _e('Cours', 'booking-manager'); ?></th>
                        <th><?php _e('Statut', 'booking-manager'); ?></th>
                        <th><?php _e('Montant', 'booking-manager'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($recent_bookings as $b): ?>
                    <tr>
                        <td>
                            <a href="<?php echo admin_url('admin.php?page=bm-bookings&booking_id=' . $b->id); ?>">
                                <?php echo esc_html($b->first_name . ' ' . $b->last_name); ?>
                            </a>
                        </td>
                        <td><?php echo esc_html($b->course_title ?? '—'); ?></td>
                        <td><span class="bm-status bm-status-<?php echo esc_attr($b->status); ?>"><?php echo esc_html($b->status); ?></span></td>
                        <td><?php echo number_format($b->total_amount, 2, ',', ' '); ?> €</td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <?php else: ?>
                <p class="bm-empty"><?php _e('Aucune réservation pour le moment.', 'booking-manager'); ?></p>
            <?php endif; ?>
        </div>
    </div>
</div>
