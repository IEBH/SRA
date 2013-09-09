$(function() {
	// Theme basic elements {{{
	$('table.properties').addClass('table table-bordered table-striped');
	// }}}
	// Wrap property attributes in badges {{{
	$('table.properties span').each(function() {
		var me = $(this)
			.addClass('badge');

		var text = me.text().toLowerCase();

		if (/string|int|array|boolean/.exec(text)) {
			me.addClass('badge-success');
		} else if (/function|object|callback|method/.exec(text)) {
			me.addClass('badge-important');
		} else if (/optional/.exec(text)) {
			me.addClass('badge-info');
		}
	});
	// }}}
	// Process inherited property tables {{{
	$('table[data-properties-inherit]').each(function() {
		var me = $(this);
		var from = me.data('properties-inherit');
		var ptable = $('table[data-properties="' + from + '"]');
		while (1) {
			var inheritedRows = ptable.find('tr:not(:first)').clone();
			inheritedRows.find('td:eq(1)').append(' <a href="#' + from + '" class="badge badge-inverse" title="Inherited from ' + from + '"><i class="icon-share icon-white"></i>' + from + '</a>');
			me.find('tbody').append(inheritedRows);
			if (ptable.data('properties-inherit')) { // Parent table in turn inherits
				from = ptable.data('properties-inherit');
				ptable = $('table[data-properties="' + from + '"]');
			} else
				break;
		}
	});
	// }}}
	// Add NavBar navigation {{{
	var path = location.pathname.split('/'); // Figure out current page
	path = path[path.length-1];

	// Fix plain UL elements in navbars to draw correctly in Bootstrap
	$('#navbar > .navbar-inner > ul:first')
		.addClass('nav')
		.children('li')
			.after('<li class="divider-vertical"></li>') // Add vertical spacer after each LI in navbar
			.each(function() {
				if ($(this).children('ul').length) { // Has children - transform into dropdown
					if (!$(this).children('a').length) { // No 'a' inner on dropdown list probbaly <ul><li>Item<ul><li>Sub-item 1...</li></ul> format
						var ul = $(this).children('ul');
						$(this).children('ul').remove();
						$(this)
							.html('<a href="#" class="dropdown-toggle" data-toggle="dropdown">' + (this.outerText || this.childNodes[0].nodeValue || 'Menu') + '</a>')
							.append(ul);
					}

					$(this)
						.addClass('dropdown')
						.children('ul')
							.addClass('dropdown-menu');
				}

				var href = $(this).children('a').attr('href');
				if (href) {
					if (href.substr(0, 1) == '/') // Stip leading '/' if present
						href = href.substr(1);
					if (href == path) // Is this the active path?
						$(this).addClass('active');
				}
			});

	// Transform all flat content tables into the correct Bootstrap classes
	$('#content table').addClass('table table-bordered table-stripped');

	// Put each H tag in the left hand Affix navigator
	$('h1, h2, h3').each(function() {
		var my = $(this);
		var link = my.text().replace(/[^a-z0-9\-_]+/gi, '-').toLowerCase();
		var title = $(this).text();
		var tag = $(this).get(0).tagName;

		my.prepend('<a name="' + link + '"/>');
		if (tag == 'H1') {
			$('#affix').append('<li><a href="#' + link + '"><i class="icon-chevron-right"></i>' + title + '</a></li>');
		} else if (tag == 'H2') {
			$('#affix').append('<li style="font-size: 12px"><a href="#' + link + '"><i class="icon-chevron-right"></i>' + title + '</a></li>');
		} else if (tag == 'H3') {
			$('#affix').append('<li style="font-size: 10px; line-height: 10px"><a href="#' + link + '"><i class="icon-chevron-right"></i>' + title + '</a></li>');
		}
	});


	$(document).on('scroll', function() {
		var docScroll = Math.ceil($('body')[0].scrollTop);
		$('#affix > li').removeClass('active');
		$('#content a[name]').each(function() {
			if (docScroll < Math.ceil($(this).closest('h1, h2, h3').offset().top)) {
				$('#affix > li > a[href="#' + $(this).attr('name') + '"]').closest('li').addClass('active');
				return false;
			}
		});
	}).trigger('scroll');
	// }}}
	// <code>batt_*</code> -> <a> wrapper {{{
	$('code').each(function() {
		var text = $(this).text();
		var matches = /^batt_(.*)$/.exec(text);
		if (matches)
			$(this).wrap('<a href="#' + text + '"></a>');
	});
	// }}}
	// Compile <pre class="example"> tags {{{
	$.exampleNo = 1;
	$('pre.example').each(function() {
		var id = $.exampleNo++;
		var examplePath = $(this).data('example-path');
		var pane = $('<div class="example">')
			.append(
				'<ul class="nav nav-tabs">' +
					'<li class="active"><a href="#example-code-' + id + '" data-toggle="tab"><i class="icon-align-left"></i> Code</a></li>' +
					'<li><a href="#example-preview-' + id + '" data-toggle="tab"><i class="icon-fire"></i> Preview</a></li>' +
					(examplePath ? '<li><a href="#example-file-' + id + '" data-toggle="tab"><i class="icon-file"></i> External file</a></li>' : '') +
				'</ul>' +
				'<div class="tab-content">' +
					'<div class="tab-pane active code" id="example-code-' + id + '">' +
					'CODE' +
					'</div>' +
					'<div class="tab-pane preview" id="example-preview-' + id + '">' +
					'PREVIEW' +
					'</div>' +
					(examplePath ? 
						'<div class="tab-pane preview" id="example-file-' + id + '">' +
						'<div class="well text-center"><h3>' + 
						'<a href="' + examplePath + '" target="_blank">View as standalone example</a>' +
						'</h3></div>' +
						'</div>'
					: '') +
				'</div>'
			);

		$(this).replaceWith(pane);
		var rawCode = $(this).html();
		var code = rawCode.replace('<', '&lt;').replace('>', '&gt;');
		pane.find('.code').html(code);
		pane.find('a[href="#example-preview-' + id + '"]')
		.on('show', function() {
			pane.find('.preview').empty().html('Loading preview...');
		})
		.on('shown', function() {
			$('#example-preview-' + id).empty();
			eval(rawCode.replace('#example', '#example-preview-' + id));
		});
	});
	// }}}
	$('#affix').on('click', 'a', function(e) {
		e.preventDefault();
		console.log($(this).attr("href"));
		var anchor = $('a[name="' + $(this).attr("href").substr(1) + '"]').first();
		if (anchor.length)
			$(document).scrollTop(anchor.position().top - 30);
	});
	if (document.location.hash)
		$('#affix a[href="' + document.location.hash + '"]').trigger('click');
});
