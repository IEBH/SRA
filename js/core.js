$(function() {
	// Apply [data-confirm] functionality {{{
	$('a[data-confirm]').click(function(event) {
		var message = $(this).data('confirm') || 'Are you really sure you wish to do this?';
		if (!confirm(message))
			event.preventDefault();
	});
	// }}}
});
