/**
* Shoelace Javascript file
* @author Matt Carter <m@ttcarter.com>
*/
$(function() {
/* data-tip {{{ */
$('[data-tip]').each(function() {
	settings = {title: $(this).data('tip')};
	if ($(this).data('tip-placement'))
		settings['placement'] = $(this).data('tip-placement');
	$(this).tooltip(settings);
});
/* }}} */
/* data-prefix, data-suffix {{{ */
$('[data-prefix], [data-suffix]').each(function() {
	var me = $(this);
	me.wrap('<div class="' + (me.data('prefix') ? 'input-prepend ' : '') + (me.data('suffix') ? 'input-append' : '') + '"></div>');
	if (me.data('prefix'))
		me.before('<span class="add-on">' + me.data('prefix') + '</span>');
	if (me.data('suffix'))
		me.after('<span class="add-on">' + me.data('suffix') + '</span>');
});
/* }}} */
/* data-help-inline, data-help-block {{{ */
$('[data-help-inline]').each(function() {
	$(this).after('<span class="help-inline">' + $(this).data('help-inline') + '</span>');
});
$('[data-help-block]').each(function() {
	$(this).after('<span class="help-block">' + $(this).data('help-block') + '</span>');
});
/* }}} */
/* data-focus {{{ */
$('[data-focus]').each(function() {
	$(this).focus();
	return false; // Only focus the first one
});
/* }}} */
/* data-selected {{{ */
$('.nav-tabs[data-selected]').each(function() {
	var hash;
	if ($(this).data('selected') == 'auto' && location.hash) {
		hash = location.hash.substr(1);
	} else if ($(this).data('selected')) {
		hash = $(this).data('selected');
	}
	var selected = $(this).find('a[href="#' + hash + '"]');
	console.log(selected);
	if (selected.length) { // Found something - select it
		selected.tab('show');
	} else { // Nothing found - fallback to first found tab
		selected = $(this).find('a:first[href]');
		if (selected.length)
			selected.tab('show');
	}
});
/* }}} */
});
