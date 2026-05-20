jQuery(document).ready(function($) {
    // Confirmation avant actions destructives
    $('[data-confirm]').on('click', function() {
        return confirm($(this).data('confirm'));
    });
});
