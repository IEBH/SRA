/**
* Batt
* Form and data manipulation library
*
* @url https://github.com/MomsFriendlyDevCo/Batt
* @author Matt Carter <m@ttcarter.com>
* @license CC-Attribution-NonCommercial-NoDerivs 3.0 Unported
* @licenseURL http://creativecommons.org/licenses/by-nc-nd/3.0/
*/

// REQUIRE - Batt objects {{{
var batt_object = require('./batt_object.js');

var batt_date = require('./batt_date.js');
batt_date.prototype = new batt_object();
var batt_choice = require('./batt_choice.js');
batt_choice.prototype = new batt_object();
var batt_choice_radio = require('./batt_choice_radio.js');
batt_choice_radio.prototype = new batt_object();
var batt_container = require('./batt_container.js');
batt_container.prototype = new batt_object();
var batt_container_splitter = require('./batt_container_splitter.js');
batt_container_splitter.prototype = new batt_container();

var batt_feed = require('./batt_feed.js');
batt_feed.prototype = new batt_container();
var batt_feed_batt = require('./batt_feed_batt.js');
batt_feed_batt.prototype = new batt_feed();

var batt_dropdown = require('./batt_dropdown.js');
batt_dropdown.prototype = new batt_container();
var batt_form = require('./batt_form.js');
batt_form.prototype = new batt_container();
var batt_reference = require('./batt_reference.js');
batt_reference.prototype = new batt_container();
var batt_table = require('./batt_table.js');
batt_table.prototype = new batt_container();
var batt_tabs = require('./batt_tabs.js');
batt_tabs.prototype = new batt_container();

var batt_input = require('./batt_input.js');
batt_input.prototype = new batt_object();
var batt_label = require('./batt_label.js');
batt_label.prototype = new batt_object();
var batt_string = require('./batt_string.js');
batt_string.prototype = new batt_input();
var batt_number = require('./batt_number.js');
batt_number.prototype = new batt_input();
var batt_text = require('./batt_text.js');
batt_text.prototype = new batt_input();

var batt_file = require('./batt_file.js');
batt_file.prototype = new batt_object();
var batt_heading = require('./batt_heading.js');
batt_heading.prototype = new batt_object();
var batt_html = require('./batt_html.js');
batt_html.prototype = new batt_object();

var batt_link = require('./batt_link.js');
batt_link.prototype = new batt_object();
var batt_button = require('./batt_button.js');
batt_button.prototype = new batt_link();
var batt_tag = require('./batt_tag.js');
batt_tag.prototype = new batt_link();

var batt_unknown = require('./batt_unknown.js');
batt_unknown.prototype = new batt_object();
// }}}
// REQUIRE - Third party modules {{{
var Mustache = require('mustache');
// }}}

global.batt = {
	debug: true, // This is changed during script compile to FALSE
	forms: {},
	usesPath: '', // Assume current directory is where we find 'uses' modules
	isReady: false,
	sets: [],
	stop: false,

	feeds: {},

	widgets: {
		button: {inherits: 'link', object: require('./batt_button.js')},
		choice: {inherits: 'object', object: require('./batt_choice.js')},
		choice_radio: {inherits: 'object', object: require('./batt_choice_radio.js')},
		container: {inherits: 'object', object: require('./batt_container.js')},
		container_splitter: {inherits: 'container', object: require('./batt_container_splitter.js')},
		date: {inherits: 'object', object: require('./batt_date.js')},
		dropdown: {inherits: 'container', object: require('./batt_dropdown.js')},
		email: {inherits: 'input', object: require('./batt_email.js')},
		feed_batt: {inherits: 'feed', object: require('./batt_feed_batt.js')},
		feed: {inherits: 'container', object: require('./batt_feed.js')},
		file: {inherits: 'object', object: require('./batt_file.js')},
		form: {inherits: 'container', object: require('./batt_form.js')},
		heading: {inherits: 'object', object: require('./batt_heading.js')},
		html: {inherits: 'object', object: require('./batt_html.js')},
		input: {inherits: 'object', object: require('./batt_input.js')},
		label: {inherits: 'object', object: require('./batt_label.js')},
		link: {inherits: 'object', object: require('./batt_link.js')},
		number: {inherits: 'input', object: require('./batt_number.js')},
		object: {object: require('./batt_object.js')},
		reference: {inherits: 'container', object: require('./batt_reference.js')},
		string: {inherits: 'input', object: require('./batt_string.js')},
		table: {inherits: 'container', object: require('./batt_table.js')},
		tabs: {inherits: 'container', object: require('./batt_tabs.js')},
		tag: {inherits: 'link', object: require('./batt_tag.js')},
		text: {inherits: 'input', object: require('./batt_text.js')},
		unknown: {inherits: 'object', object: require('./batt_unknown.js')}
	},

	/**
	* Variables available to object.parse()
	* @var hash
	*/
	parseGlobals: {
		/**
		* Extracts a URL segment using a mangled version of a glob
		* 
		* Tokens:
		*	- '*' - Match any number of characters
		*	- '?' - Match one chracter
		*	- '!' - Capture this
		*
		* Examples:
		*	- {{#url}}/users/!{{/url}}
		*	- {{#url}}/path/to/dir/!{{/url}}
		*	- {{#url}}/users/type/* /userid!{{/url}} (space added after '*' so not to upset syntax parsers that see it as end-of-comments)
		*/
		url: function(text, render) { // Url extractor function - e.g. 
			return function(text, render) {
				var reStr = text
					.replace('*', '<FILTER:ANY>')
					.replace('?', '<FILTER:ONE>')
					.replace('!', '<FILTER:CAPTURE>')
					.replace(/([.?*+^$[\]\/\\(){}|-])/g, "\\$1")
					.replace('<FILTER:ANY>', '.*')
					.replace('<FILTER:ONE>', '.')
					.replace('<FILTER:CAPTURE>', '(.*)');
				var re = new RegExp(reStr);
				var found = re.exec(document.location.pathname);
				var bit = found[1] || '';
				return bit;
			}
		}
	},

	ready: function() {
		this.isReady = true;

		$.each(this.sets, function(i, set) {
			console.log('Trigger load of', set);
			if (set.element) { // Load into element i.e. invoke $(element).batt(content)
				set.element.batt(set.content);
			} else // No element - probably an anonymous load (i.e. batt.set(content))
				batt.set(set.content);
		});

		this.sets = [];
	},

	makeObject: function(type) {
		var obj;
		type = type.replace('-', '_');
		if (!batt.widgets[type]) {
			obj = batt.makeObject('unknown');
			obj.typeFailed = type;
			return obj;
		} else {
			if (batt.widgets[type].inherits)
				batt.widgets[type].object.prototype = new batt.widgets[batt.widgets[type].inherits].object();
			obj = new batt.widgets[type].object();
		}
		obj.type = type;
		if (batt.widgets[type].inherits) { // Glue prototype accessor to .super
			var proto = new batt.widgets[batt.widgets[type].inherits].object();
			obj.super = proto;
		}
		return obj;
	},

	/**
	* Load a Batt plugin from plugins/$name.js
	* This is really just a dumb wrapper for $script()
	* @param string|array name Either a single plugin to load or an array of plugins to load
	*/
	plugin: function(name) {
		if (typeof name == 'array') { // Given an array - overload to individual calls
			for (var p in name)
				batt.plugin(name[p]);
		} else {
			console.log('Batt> Loading plugin ', name);
			$script(batt.path + '/plugins/' + name + '.js');
		}
	},

	/**
	* Load generic Batt spec into an anonymous object
	* This will never actually appear. Its mostly used to load db-table widgets etc
	* @param string json The Batt object spec to load
	*/
	set: function(json) {
		var id = batt.getUniqueId('batt-form-');
		if (batt.isReady) {
			batt.forms[id] = new batt_form();
			batt.forms[id].type = 'form';
			batt.forms[id].set(json);
		} else { // Not yet ready
			console.log('Batt not yet ready. Defered load for anonymous object', id);
			batt.sets.push({
				content: json
			});
		}
	},

	find: function(id) {
		if (batt.forms[id]) // Is the ID an actual form?
			return batt.forms[id];

		for (var f in batt.forms) { // Nope. Recurse into each form
			var found = batt.forms[f].find(id);
			if (found)
				return found;
		}
		return null;
	},

	/**
	* Simple wrapper to run a function on ALL batt objects
	* This is really just a dumb wrapper for running .eachChild on all items in the batt.forms hash
	* @param callback callback The callback function to run. Called in the format function() {} setting 'this' to the current context
	* @param hash options A hash of options to use when filtering
	* @see batt_container/eachChild()
	*/
	eachChild: function(callback, options) {
		for (var f in batt.forms) {
			if (batt.forms[f].eachChild(callback, options) === false)
				return;
		}
	},

	submit: function() {
		for (var f in batt.forms) {
			batt.forms[f].submit();
		}
	},

	/**
	* Scripts that loadScripts() is waiting on.
	* These are usually from tags specified using 'src="path"' in the tag
	* @access private
	*/
	loadScriptsSrc: {},

	/**
	* Scripts that are waiting to load from this document.
	* Similar to loadScriptsSrc except we have these from inline
	* @access private
	*/
	loadScriptsInline: [],

	/**
	* Information about the script currently being eval()'ed
	* This is used by the $(window).on('error') handler to display a nice message rather than just giving up
	* @var array
	* @access private
	*/
	evalInfo: null,

	/**
	* Process all <script type="batt" [src="path"]/> tags
	*/
	loadScripts: function() {
		var ready = 1;
		$('script[type="batt"]').each(function() {
			var script = $(this);
			var scriptSrc = script.attr('src');
			if (scriptSrc) { // Has an src="path" attribute
				if (batt.loadScriptsSrc[scriptSrc] == 'loading') { // Still waiting for this script to load
					ready = 0;
				} else if (batt.loadScriptsSrc[scriptSrc] == 'loaded') { // Loaded content - this script is ready
					// Do nothing
				} else if (!batt.loadScriptsSrc[scriptSrc]) { // First mention of this script we've seen - trigger AJAX load
					batt.loadScriptsSrc[scriptSrc] = 'loading';
					$.ajax({
						url: scriptSrc,
						dataType: 'text',
						type: 'GET',
						data: {noheaders: 1},
						cache: true,
						success: function(html) {
							batt.loadScriptsSrc[scriptSrc] = 'loaded';
							script.replaceWith(html);
							batt.loadScripts();
						},
						error: function(jqxhr, errText, errThrown) {
							console.warn('Error while loading <script src="' + scriptSrc + '"/>', errText, errThrown); // FIXME: deal with this gracefully
						}
					});
					ready = 0;
				}
			} else { // Load from content
				var newId = batt.getUniqueId('batt-');
				script.before('<div id="' + newId + '"></div>')
				var form = {action: script.attr('action')};
				batt.loadScriptsInline.push(
					'$(\'#' + newId + '\').batt(' + script.html() + ', ' + JSON.stringify(form) + ');'
				);
				script.remove();
			}
		});
		if (ready) {
			$(window).on('error', function(e) {
				console.log('CAUGHT', e.originalEvent, batt.evalInfo);
				batt.stop = 1;
				if (batt.evalInfo) { // We have something to complain about
					var box = $(batt.evalInfo.id);
					var message = e.originalEvent.message.replace(/^Uncaught SyntaxError: /, '');
					var line = e.originalEvent.lineno;
					box.append('<div class="alert alert-block alert-error"><h3>Batt failed to load - ' + message + (line ? ' (Line: ' + line + ')' : '') + '</h3></div>');
					if (line) { // We have a specific line number to look at
						var block = batt.loadScriptsInline[batt.evalInfo.loadScriptsInlineOffset].split("\n");
						box.find('div.alert')
							.append($('<pre></pre>').text(block.slice(0, line - 1).join("\n")))
							.append('<div class="label label-warning">' + message + ':</div>')
							.append($('<pre class="alert"></pre>').text(block.slice(line - 1, line)))
							.append($('<pre></pre>').text(block.slice(line).join("\n")));
						
					} else { // We have no idea where the error occured
						box.find('div.alert').append(
							$('<pre></pre>').text(batt.loadScriptsInline[batt.evalInfo.loadScriptsInlineOffset])
						);
					}
				}
			});
			for (var i = batt.loadScriptsInline.length - 1; i > -1; i--) {
				var matches = /\$\('(.*)'\)\.batt\(/.exec(batt.loadScriptsInline[i]);
				batt.evalInfo = {
					loadScriptsInlineOffset: i,
					id: matches[1]
				};
				eval(batt.loadScriptsInline[i]);
			}
			batt.evalInfo = null;
			batt.loadScriptsInline = [];
		} else {
			console.log('Inline <script> tags waiting on', Object.keys(batt.loadScriptsSrc));
		}
	},

	// Utility functions {{{
	/**
	* Parse a Mustache template
	* @param string string The string to parse and return
	* @param object Additional object data to include in the template
	* @return string The parsed string
	*/
	parse: function(string, data) {
		var data = $.extend({}, batt.parseGlobals, data);
		var out = Mustache.render(string, data);
		// console.log('BATT.PARSE', string, '=', out, data);
		return out;
	},

	/**
	* Sanitize a string and return the safe version devoid of anything dangerous
	* @param string value The string to sanitize
	* @param string prefix Optional prefix to prepend to the output
	* @return string The safe version of the input 'value'
	*/
	safeString: function(value, prefix) {
		return (prefix?prefix:'') + value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
	},

	/**
	* Return a unique ID for an item based on a prefix
	* This is usually used to allocate an HTML ID to an element that doesnt already have one
	*/
	getUniqueId: function(prefix) {
		if (!prefix)
			prefix = 'batt-';
		while (1) {
			var id = prefix + Math.floor(Math.random()*99999);
			if ($('#' + id).length == 0)
				return id;
		}
	}
	// }}}
};

batt.ready();

$.fn.extend({
	/**
	* Convenience constructor to invoke Batt on an element
	* @param string json RAW Batt JSON speification
	* @param object formObject Additional parameters to import when creating the wrapper form e.g. {action: '/submit/here'}
	*/
	batt: function(json, formObject) {
		return this.each(function() {
			var me = $(this);
			var id = me.attr('id');
			var content = json || me.text();
			if (!id) { // Make sure the item has an ID - make one if necessary
				id = batt.getUniqueId('batt-form-');
				me.attr('id', id)
			}
			if (batt.isReady) {
				batt.forms[id] = batt.makeObject('form');
				batt.forms[id].set(content);
				if (formObject)
					$.extend(batt.forms[id], formObject);
				batt.forms[id].setup.call(batt.forms[id], me);
				batt.forms[id].render.call(batt.forms[id]);
			} else { // Not yet ready
				console.log('Batt not yet ready. Defered load for form', id);
				batt.sets.push({
					element: me,
					content: content
				});
			}
		});
	}
});

// Trigger initial sweep for <script type="batt"/> tags
$(batt.loadScripts);
