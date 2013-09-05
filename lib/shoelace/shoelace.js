/**
* Shoelace Javascript file
* @author Matt Carter <m@ttcarter.com>
*/
$(function() {
/* data-tip {{{ */
$('[data-tip]').each(function() {
	var root = $(this);
	var addto = root;
	var tag = root[0].nodeName.toLowerCase();
	if (tag == 'th' || tag == 'td') // Fix for TR, TH elements with a tooltip
		addto = root.wrapInner('<div></div>').children('div');
	settings = {title: root.data('tip')};
	if (root.data('tip-placement'))
		settings['placement'] = root.data('tip-placement');
	addto.tooltip(settings);
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
	if (!$(this).closest('.modal').length && $(this).is(':visible')) // Not within a modal && is visible
		$(this).focus();
	return false; // Only focus the first one
});
$('.modal').on('shown', function() {
	$(this).find('[data-focus]').focus();
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
/* data-selectbyurl {{{ */
/**
* Perform a depth first nav-list traversal to find the most probable link to select from a set
* Because we could be at a really deeply nested page like /foo/bar/baz we need to select any link that points to /foo/bar but not /foo
* This upshot is that we highlight the correct (usually) link in a Bootstrap .nav-list whenever the page loads
* @author Matt Carter <m@ttcarter.com>
*/
$('[data-selectbyurl]').each(function() {
	var path = window.location.pathname;
	var children = $(this).find($(this).data('selectbyurl') || 'li');
	var parents = $(this).find($(this).data('selectbyurl-parents') || '');
	var selected;
	var selectedlink;
	if (path == '/' && children.find('a[href="/"]').length) { // Root item selected
		selected = children.find('a[href="/"]').closest('li');
	} else
		children.each(function() {
			var href = $(this).find('a').attr('href');
			if (href && href == window.location.pathname) { // Exact matches get caught immediately
				selected = $(this);
				return false;
			} else if ( // Imprecise (fuzzy) matches need to be examined
				href // Has a href
				&& (href.substr(0, window.location.pathname.length) == window.location.pathname) // beginning of href matches beginning of window.location.pathname
				&& (!selectedlink || $(this).attr('href').length > selectedlink.length) // Its longer than the last match
			) {
				selected = $(this);
				selectedlink = selected.attr('href');
			}
		});
	if (selected) {
		selected.addClass('active');
		if (parents)
			selected.parents(parents)
				.addClass('active');
	}
});
/* }}} */
	// [data-confirm] {{{
	$('a[data-confirm]').click(function(event) {
		var message = $(this).data('confirm') || 'Are you really sure you wish to do this?';
		if (!confirm(message))
			event.preventDefault();
	});
	// }}}
});
