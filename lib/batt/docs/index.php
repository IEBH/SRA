<!DOCTYPE HTML>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>Batt Documentation</title>

	<? include('../src/batt_debug.php') ?>

	<script>
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
			} else if (/function|object/.exec(text)) {
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
				inheritedRows.find('td:eq(1)').append(' <span class="badge badge-inverse">Inherited from ' + from + '</span>');
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
	});
	</script>
	<style>
	h1 {
		margin: 30px 0 15px 0;
		border-bottom: 1px solid #ddd;
		font-size: 35px;
		padding-bottom: 12px;
	}

	h2 {
		font-size: 25px;
		border-bottom: 1px solid #CCC;
	}

	#content {
		margin-top: 20px;
	}

	#content .span9 {
		margin-left: 18%;
	}

	#content .span9 a[name] {
		display: block;
		position: relative;
		top: -45px;
	}


	#navbar .navbar-inner {
		padding-left: 20px;
	}

	#affix {
		width: 16%;
		margin-top: 60px;
		padding: 0px;
		background-color: #fff;
		-webkit-border-radius: 6px;
		-moz-border-radius: 6px;
		border-radius: 6px;
		-webkit-box-shadow: 0 1px 4px rgba(0,0,0,.065);
		-moz-box-shadow: 0 1px 4px rgba(0,0,0,.065);
		box-shadow: 0 1px 4px rgba(0,0,0,.065);
	}

	#affix > li > a {
		display: block;
		margin: 0 0 -1px;
		padding: 8px 14px;
		border: 1px solid #e5e5e5;
	}

	#affix > li:first-child > a {
		-webkit-border-top-left-radius: 6px;
		-webkit-border-top-right-radius: 6px;
		-moz-border-top-left-radius: 6px;
		-moz-border-top-right-radius: 6px;
		border-top-left-radius: 6px;
		border-top-right-radius: 6px;
	}

	#affix > li:last-child > a {
		-webkit-border-bottom-left-radius: 6px;
		-webkit-border-bottom-right-radius: 6px;
		-moz-border-bottom-left-radius: 6px;
		-moz-border-bottom-right-radius: 6px;
		border-bottom-left-radius: 6px;
		border-bottom-right-radius: 6px;
	}

	#affix > li > a > i {
		float: right;
	}

	.example {
		min-height: 20px;
		padding: 7px;
		margin-bottom: 20px;
		background-color: #f5f5f5;
		border: 1px solid #e3e3e3;
		-webkit-border-radius: 4px;
		-moz-border-radius: 4px;
		border-radius: 4px;
		-webkit-box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.05);
		-moz-box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.05);
		box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.05);
	}

	.example .nav {
		margin-bottom: 0px;
	}

	.example .tab-pane {
		padding: 10px 19px 14px;
		background-color: #fff;
		border-left: 1px solid #ddd;
		border-right: 1px solid #ddd;
		border-bottom: 1px solid #ddd;
		-webkit-border-radius: 4px;
		-moz-border-radius: 4px;
		border-radius: 4px;
	}

	.example .code {
		white-space: pre;
		font-family: 'Lucida console', monospace;
		font-size: 8pt;
		line-height: 10pt;
	}
	</style>
</head>
<body>
	<!-- Page opening {{{ -->
	<div id="content" class="container-fluid">
		<div class="row-fluid">
			<div class="span3 hidden-phone">
				<ul id="affix" class="nav nav-list affix"></ul>
			</div>
			<div class="span9">
	<!-- }}} Page opening -->

	<h1>Batt Documentation</h1>

	<h2>Basics</h2>
	<p>Batt is a form generation library that works of a tree structure of widgets.</p>
	<p>Heres an example of a simple <em>Contact Us</em> form.</p>

<pre class="example" data-example-path="/examples/contact_form">
$('#example').batt([
	{
		type: 'heading',
		title: 'Contact us'
	},
	{
		type: 'string',
		title: 'Your name',
		placeholder: 'John Smith'
	},
	{
		type: 'string',
		title: 'Your email address',
		placeholder: 'someone@somewhere.com'
	},
	{
		type: 'text',
		title: 'What did you want to say to us?',
		placeholder: 'I love you!'
	},
	{
		type: 'button',
		action: 'submit',
		text: '<i class="icon-envelope"></i> Send email',
		class: 'btn btn-success'
	}
]);
</pre>

	<p>It's also possible to have widgets-within-widgets. Here's an example using a simple tab sheet:</p>

<pre class="example">
$('#example').batt([
	{
		type: 'tabs',
		children: [
			{
				type: 'html',
				title: 'Foo',
				text: 'Hello World - Foo!'
			},
			{
				type: 'html',
				title: 'Bar',
				text: 'Hello World - Bar!'
			},
			{
				type: 'html',
				title: 'Baz',
				text: 'Hello World - Baz!'
			}
		]
	}
]);
</pre>

	<h2>Object Reference</h2>

	<ul>
		<li><code>batt_object</code>
		<ul>
			<li><code>batt_date</code></li>
			<li><code>batt_choice</code></li>
			<li><code>batt_choice_radio</code></li>
			<li><code>batt_container</code>
			<ul>
				<li><code>batt_db_table</code></li>
				<li><code>batt_dropdown</code></li>
				<li><code>batt_form</code></li>
				<li><code>batt_table</code></li>
				<li><code>batt_tabs</code></li>
			</ul></li>
			<li><code>batt_input</code>
			<ul>
				<li><code>batt_string</code></li>
				<li><code>batt_number</code></li>
				<li><code>batt_text</code></li>
			</ul></li>
			<li><code>batt_heading</code></li>
			<li><code>batt_html</code>
			<li><code>batt_link</code>
			<ul>
				<li><code>batt_button</code></li>
			</ul></li>
			<li><code>batt_unknown</code></li>
		</ul></li>
	</ul>

	<h3>batt_button</h3>
	<p>A button which can be bound to an action or a link.</p>

	<table class="properties" data-properties="batt_button" data-properties-inherit="batt_link">
		<tr>
			<th>Property</th>
			<th>Attributes</th>
			<th>Default</th>
			<th>Description</th>
		</tr>
		<tr>
			<td>action</td>
			<td><span>String</span> <span>Optional</span> <span>FIXME</span></td>
			<td><code>nothing</code></td>
			<td>The action to take when the button is pressed.</td>
		</tr>
		<tr>
			<td>text</td>
			<td><span>String</span></td>
			<td><code>A button</em></td>
			<td>The text to draw on the button</td>
		</tr>
		<tr>
			<td>class</td>
			<td><span>String</span></td>
			<td><code>btn</code></td>
			<td>The style information for the button</td>
		</tr>
	</table>

	<h3>batt_choice</h3>
	<p>A single selection list of items - usually drawn as a dropdown where only one item can be selected at a time</p>

	<table class="properties" data-properties="batt_choice" data-properties-inherit="batt_object">
		<tr>
			<th>Property</th>
			<th>Attributes</th>
			<th>Default</th>
			<th>Description</th>
		</tr>
		<tr>
			<td>choices</td>
			<td><span>Array</span></td>
			<td><code>{foo: 'Foo', bar: 'Bar', baz: 'Baz'}</code></td>
			<td>A hash of options to allow the user to select from</td>
		</tr>
	</table>

	<h3>batt_choice_radio</h3>
	<p>Similar functionality to batt_choice but this time the options are drawn as a single-selection radio box list</p>

	<table class="properties" data-properties="batt_choice_radio" data-properties-inherit="batt_object">
		<tr>
			<th>Property</th>
			<th>Attributes</th>
			<th>Default</th>
			<th>Description</th>
		</tr>
		<tr>
			<td>choices</td>
			<td><span>Array</span></td>
			<td><code>{foo: 'Foo', bar: 'Bar', baz: 'Baz'}</code></td>
			<td>A hash of options to allow the user to select from</td>
		</tr>
	</table>

	<h3>batt_container</h3>
	<p>Meta object to group multiple items together.</p>
	<p>Containers can also be used to bind data to all child items.</p>

	<table class="properties" data-properties="batt_container" data-properties-inherit="batt_object">
		<tr>
			<th>Property</th>
			<th>Attributes</th>
			<th>Default</th>
			<th>Description</th>
		</tr>
		<tr>
			<td>children</td>
			<td><span>Array</span></td>
			<td><em>Null</em></td>
			<td>A hash array of all children under this container</td>
		</tr>
		<tr>
			<td>childrenOrder</td>
			<td><span>Array</span></td>
			<td><code>Object.keys(this.children)</code></td>
			<td>An ordered array of which order to draw <code>this.children</code> in. This field will be automatically populated with the contents of <code>children</code> in most cases.</td>
		</tr>
		<tr>
			<td>implyChild</td>
			<td><span>String</span></td>
			<td><code>unknown</code></td>
			<td>An option to specify what all child item types should be if unspecified. This is useful when creating items such as dropdowns where all children are assumed to be of the type <code>batt_link</code></td>
		</tr>
		<tr>
			<td>dataSource</td>
			<td><span>Object</span></td>
			<td><code>{ table: 'TABLE', filter: {}, limit: null }</code></td>
			<td>
				An object structure to define how data is retrieved from a <code>batt_table</code> object.
				An example of the format for a table named 'foo' which is only expected to return one item:
				<code>
				{
					table: 'foo',
					limit: 1,
				}
				</code>
			</td>
		</tr>
		<tr>
			<td>eachChild(callback, options)</td>
			<td><span>Method</span></td>
			<td><code>N/A</code></td>
			<td>
				Run the provided callback function on each child and each nested child.<br/>
				This function sets <code>this</code> to be the current child in each case<br/>
				Additional options can be specified as a hash:<ul>
					<li><code>andSelf</code> - Boolean specifying as to whether <code>this</code> object should be included as a callback before the children</li>
				</ul>
			</td>
		</tr>
		<tr>
			<td>find(id)</td>
			<td><span>Method</span></td>
			<td><code>N/A</code></td>
			<td>Locate a specific field by its ID. This function searches all children, grand-children etc. </td>
		</tr>
		<tr>
			<td>determineUses(json)</td>
			<td><span>Method</span></td>
			<td><code>N/A</code></td>
			<td>
				Scan a piece of unprocessed JSON code for unique mentions of the <code>uses</code> directive.<br/>
				This function will return all uses (even deeply nested ones) as a flat array.
			</td>
		</tr>
		<tr>
			<td>set(json)</td>
			<td><span>Method</span></td>
			<td><code>N/A</code></td>
			<td>Populate all children from a piece of JSON code.</td>
		</tr>
		<tr>
			<td>getData()</td>
			<td><span>Method</span></td>
			<td><code>N/A</code></td>
			<td>
				Return either the next data item (from <code>dataSource</code> or <em>Null</em>)<br/>
				This function also sets <code>this.data</code> to the current data pointer.
			</td>
		</tr>
		<tr>
			<td>loadContainerData(callback)</td>
			<td><span>Method</span></td>
			<td><code>N/A</code></td>
			<td>Used internally as a callback when data is being retrieved. </td>
		</tr>
		<tr>
			<td>renderRow(element, parent)</td>
			<td><span>Method</span></td>
			<td><code>N/A</code></td>
			<td>Internal function to attach a given element to a container row.</td>
		</tr>
		<tr>
			<td>renderTag</td>
			<td><span>String</span></td>
			<td><code>&lt;div&gt;&lt;/div&gt;</code></td>
			<td>The constructor used to create the container.</td>
		</tr>
	</table>

	<h3>batt_date</h3>
	<p>Field which allows the display and selection of date and time.</p>

	<table class="properties" data-properties="batt_date" data-properties-inherit="batt_object">
		<tr>
			<th>Property</th>
			<th>Attributes</th>
			<th>Default</th>
			<th>Description</th>
		</tr>
		<tr>
			<td>showDate</td>
			<td><span>Boolean</span></td>
			<td><code>true</code></td>
			<td>Whether to show and allow the section of date</td>
		</tr>
		<tr>
			<td>showTime</td>
			<td><span>Boolean</span></td>
			<td><code>true</code></td>
			<td>Whether to show and allow the section of time</td>
		</tr>
		<tr>
			<td>readOnly</td>
			<td><span>Boolean</span></td>
			<td><code>false</code></td>
			<td>Whether actions from the user should be disabled</td>
		</tr>
	</table>

	<h3>batt_db_table</h3>
	<p>Meta object that defines data table behaviour.</p>
	<p>These objects can be specified anywhere in code. Since they only contain data about database tables they will also never render.</p>

	<table class="properties" data-properties="batt_db_table" data-properties-inherit="batt_container">
		<tr>
			<th>Property</th>
			<th>Attributes</th>
			<th>Default</th>
			<th>Description</th>
		</tr>
	</table>

	<h3>batt_dropdown</h3>
	<p>A simple button with a dropdown menu attached.</p>
	<p>All child items of this object are implied (via <code>implyChild</code>) to have the <code>batt_link</code> type.</p>

	<table class="properties" data-properties="batt_dropdown" data-properties-inherit="batt_container">
		<tr>
			<th>Property</th>
			<th>Attributes</th>
			<th>Default</th>
			<th>Description</th>
		</tr>
		<tr>
			<td>title</td>
			<td><span>String</span></td>
			<td><code>&gt;i class="icon-align-justify"&lt;&gt;/i&lt;</code></td>
			<td>The text to display on the dropdown</td>
		</tr>
	</table>

	<h3>batt_form</h3>
	<p>An extension of the <code>batt_container</code> object to provide a single interface for managing input.</p>

	<table class="properties" data-properties="batt_form" data-properties-inherit="batt_container">
		<tr>
			<th>Property</th>
			<th>Attributes</th>
			<th>Default</th>
			<th>Description</th>
		</tr>
		<tr>
			<td>submit</td>
			<td><span>Function</span></td>
			<td><em>Built-in</em></td>
			<td>The function run when the form is submitted</td>
		</tr>
	</table>

	<h3>batt_heading</h3>
	<p>A simple headings for a form to group items together.</p>

	<table class="properties" data-properties="batt_heading" data-properties-inherit="batt_object">
		<tr>
			<th>Property</th>
			<th>Attributes</th>
			<th>Default</th>
			<th>Description</th>
		</tr>
		<tr>
			<td>title</td>
			<td><span>String</span></td>
			<td><code>A heading</code></td>
			<td>The heading text to draw</td>
		</tr>
	</table>

	<h3>batt_html</h3>
	<p>Render a generic chunk of HTML.</p>

	<table class="properties" data-properties="batt_html" data-properties-inherit="batt_object">
		<tr>
			<th>Property</th>
			<th>Attributes</th>
			<th>Default</th>
			<th>Description</th>
		</tr>
		<tr>
			<td>class</td>
			<td><span>String</span></td>
			<td><em>Null</em></td>
			<td>Optional number of classes for the HTML to inherit</td>
		</tr>
		<tr>
			<td>text</td>
			<td><span>String</span></td>
			<td><code>&lt;div class="alert alert-info"&gt;Hello World&lt;/div&gt;</code></td>
			<td>The HTML to render</td>
		</tr>
	</table>

	<h3>batt_link</h3>
	<p>A simple hyperlink.</p>

	<table class="properties" data-properties="batt_link" data-properties-inherit="batt_object">
		<tr>
			<th>Property</th>
			<th>Attributes</th>
			<th>Default</th>
			<th>Description</th>
		</tr>
		<tr>
			<td>action</td>
			<td><span>String</span></td>
			<td><code>nothing</code></td>
			<td>
				The location the link should redirect to or an internal action.<br/>
				Relative or absolute address can also be specified e.g. <code>http://google.com</code> or <code>/docs</code>.<br/>
				Actions supported: <ul>
					<li><code>nothing</code> - A notice will be displayed and nothing will happen</li>
					<li><code>submit</code> / <code>save</code> - The parent form will be submitted</li>
				</ul>
			</td>
		</tr>
		<tr>
			<td>title</td>
			<td><span>String</span></td>
			<td><code>A heading</code></td>
			<td>The text of the link to display</td>
		</tr>
	</table>

	<h3>batt_input</h3>
	<p>Basic HTML input element.</p>

	<table class="properties" data-properties="batt_input" data-properties-inherit="batt_object">
		<tr>
			<th>Property</th>
			<th>Attributes</th>
			<th>Default</th>
			<th>Description</th>
		</tr>
		<tr>
			<td>placeholder</td>
			<td><span>String</span></td>
			<td><em>Null</em></td>
			<td>Text to render behind the element to prompt the user to enter something</td>
		</tr>
		<tr>
			<td>required</td>
			<td><span>Boolean</span></td>
			<td><code>false</code></td>
			<td>Whether the data field has to have <em>some</em> content in order to submit the form.</td>
		</tr>
		<tr>
			<td>lengthMax</td>
			<td><span>Int</span></td>
			<td><em>Null</em></td>
			<td>The maximum length (in characters) that this field should allow.</td>
		</tr>
		<tr>
			<td>lengthMin</td>
			<td><span>Int</span></td>
			<td><em>Null</em></td>
			<td>The minimum length (in characters) that this field should allow.</td>
		</tr>
		<tr>
			<td>readOnly</td>
			<td><span>Boolean</span></td>
			<td><code>false</code></td>
			<td>Whether this field should not be allowed to be changed by the user.</td>
		</tr>
		<tr>
			<td>errorRequired</td>
			<td><span>String</span></td>
			<td><code>String required</code></td>
			<td>The validation message to display when <code>required</code> fails during validation</td>
		</tr>
		<tr>
			<td>errorLengthMin</td>
			<td><span>String</span></td>
			<td><code>String too short</code></td>
			<td>The validation message to display when <code>lengthMin</code> fails during validation</td>
		</tr>
		<tr>
			<td>errorLengthMax</td>
			<td><span>String</span></td>
			<td><code>String too long</code></td>
			<td>The validation message to display when <code>lengthMax</code> fails during validation</td>
		</tr>
		<tr>
			<td>change</td>
			<td><span>Function</span></td>
			<td><em>Built-in</em></td>
			<td>The function triggered when the input elements value changes</td>
		</tr>
	</table>

	<h3>batt_number</h3>
	<p>Basic number input element.</p>

	<table class="properties" data-properties="batt_number" data-properties-inherit="batt_input">
		<tr>
			<th>Property</th>
			<th>Attributes</th>
			<th>Default</th>
			<th>Description</th>
		</tr>
		<tr>
			<td>min</td>
			<td><span>Int</span> <span>Optional</span></td>
			<td><em>Null</em></td>
			<td>The minimum allowed number the field should accept</td>
		</tr>
		<tr>
			<td>max</td>
			<td><span>Int</span> <span>Optional</span></td>
			<td><em>Null</em></td>
			<td>The maximum allowed number the field should accept</td>
		</tr>
		<tr>
			<td>decimals</td>
			<td><span>Int</span></td>
			<td><code>0</code></td>
			<td>The number of decimal places the field should render and accept</td>
		</tr>
		<tr>
			<td>errorMin</td>
			<td><span>String</span></td>
			<td><code>Number too small</code></td>
			<td>The validation message to display when <code>min</code> fails during validation</td>
		</tr>
		<tr>
			<td>errorMax</td>
			<td><span>String</span></td>
			<td><code>Number too large</code></td>
			<td>The validation message to display when <code>min</code> fails during validation</td>
		</tr>
	</table>

	<h3>batt_object</h3>
	<p>The base class from which all other Batt objects are derived.</p>

	<table class="properties" data-properties="batt_object">
		<tr>
			<th>Property</th>
			<th>Attributes</th>
			<th>Default</th>
			<th>Description</th>
		</tr>
		<tr>
			<td>containerDraw</td>
			<td><span>String</span></td>
			<td><code>with-label</code></td>
			<td>
				Instructions for the parent container object on how to render the element.<br/>
				Valid options:
				<ul>
					<li><code>row</code> / <code>entire-row</code> - Draw as an entire row (i.e. dont render anything around the output object)</li>
					<li><code>span</code> - Expand over the space normally used for the label (i.e. use the space allocated for both the label and normally the field)</li>
					<li><code>hide-label</code> / <code>buttons</code> - Draw the field in the normal location but do not draw a label</li>
					<li><code>with-label</code> / <code>normal</code> - Draw the label + field normally</li>
				</ul>
			</td>
		</tr>
		<tr>
			<td>id</td>
			<td><span>String</span> <span>Optional</span></td>
			<td><em>Null</em></td>
			<td>The unique ID identifying the object</td>
		</tr>
		<tr>
			<td>element</td>
			<td><span>DOM Object</span> <span>Optional</span></td>
			<td><em>Null</em></td>
			<td>The currently assigned DOM object to the Batt field</td>
		</tr>
		<tr>
			<td>uses</td>
			<td><span>String OR Array</span> <span>Optional</span></td>
			<td><em>Null</em></td>
			<td>What db-table to inherit properties from when defining this object or any child object</td>
		</tr>
		<tr>
			<td>value</td>
			<td><span>String</span> <span>Optional</span></td>
			<td><em>Null</em></td>
			<td>The current value of the Batt field</td>
		</tr>
		<tr>
			<td>default</td>
			<td><span>String</span> <span>Optional</span></td>
			<td><em>Null</em></td>
			<td>The default value of the field if value is unset.</td>
		</tr>
		<tr>
			<td>render</td>
			<td><span>Function</span></td>
			<td><em>Built-in</em></td>
			<td>This is a dummy function usually overridden by upstream objects</td>
		</tr>
		<tr>
			<td>validate</td>
			<td><span>Function</span></td>
			<td><em>Built-in</em></td>
			<td>The function triggered when the field is asked to validate itself</td>
		</tr>
		<tr>
			<td>loadData</td>
			<td><span>Function</span></td>
			<td><em>Built-in</em></td>
			<td>The function triggered just before <code>render</code> to inherit data from <code>data</code> or user input if either are present</td>
		</tr>
	</table>

	<h3>batt_string</h3>
	<p>Simple text input on a single line.</p>

	<table class="properties" data-properties="batt_string" data-properties-inherit="batt_input">
		<tr>
			<th>Property</th>
			<th>Attributes</th>
			<th>Default</th>
			<th>Description</th>
		</tr>
		<tr>
			<td>render</td>
			<td><span>Function</span></td>
			<td><em>Built-in</em></td>
			<td>The function to render the field. </td>
		</tr>
		<tr>
			<td>validate</td>
			<td><span>Function</span></td>
			<td><em>Built-in</em></td>
			<td>The function to validate the field. </td>
		</tr>
	</table>

	<h3>batt_table</h3>
	<p>An extension to the <code>batt_container</code> object which draws a table</p>
	<p>Each child of the object represents a column. The <code>columnTitle</code> or <code>title</code> (in that order) will be used of each child to determinet the column title.</p>
	<p>If specified for the child <code>columnWidth</code> will also be used to draw the table.</p>

	<table class="properties" data-properties="batt_table" data-properties-inherit="batt_container">
		<tr>
			<th>Property</th>
			<th>Attributes</th>
			<th>Default</th>
			<th>Description</th>
		</tr>
	</table>

	<h3>batt_tabs</h3>
	<p>An extension to the <code>batt_container</code> object which draws a set of tabs</p>
	<p>Each child of the object represents a tab pane.</p>

	<table class="properties" data-properties="batt_tabs" data-properties-inherit="batt_container">
		<tr>
			<th>Property</th>
			<th>Attributes</th>
			<th>Default</th>
			<th>Description</th>
		</tr>
		<tr>
			<td>default</td>
			<td><span>Int</span></td>
			<td><code>0</code></td>
			<td>The offset of the tab to select by default</td>
		</tr>
	</table>

	<h3>batt_text</h3>
	<p>Multi-line text input</p>

	<table class="properties" data-properties="batt_text" data-properties-inherit="batt_input">
		<tr>
			<th>Property</th>
			<th>Attributes</th>
			<th>Default</th>
			<th>Description</th>
		</tr>
		<tr>
			<td>render</td>
			<td><span>Function</span></td>
			<td><em>Built-in</em></td>
			<td>The function to render the field. </td>
		</tr>
	</table>

	<h3>batt_unknown</h3>
	<p>Fallback object used when Batt cannot determine the type of an object.</p>
	<p>This is usually used as a marker when refering to interfaces that have not been implemented yet.</p>

	<table class="properties" data-properties="batt_unknown" data-properties-inherit="batt_object">
		<tr>
			<th>Property</th>
			<th>Attributes</th>
			<th>Default</th>
			<th>Description</th>
		</tr>
	</table>

	<!-- Page closing {{{ --!>
			</div>
		</div>
	</div>
	<!-- }}} Page closing --!>
</body>
</html>
