/**
* Batt
* Form and data manipulation library
*
* @url https://github.com/MomsFriendlyDevCo/Batt
* @author Matt Carter <m@ttcarter.com>
* @license CC-Attribution-NonCommercial-NoDerivs 3.0 Unported
* @licenseURL http://creativecommons.org/licenses/by-nc-nd/3.0/
*/
$.extend({batt: {
	debug: true, // This is changed during script compile to FALSE
	forms: {},
	usesPath: '', // Assume current directory is where we find 'uses' modules
	isReady: false,
	sets: [],

	tables: {},

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
		console.log('BATT READY');
		this.isReady = true;

		$.each(this.sets, function(i, set) {
			console.log('Trigger load of', set);
			if (set.element) { // Load into element i.e. invoke $(element).batt(content)
				set.element.batt(set.content);
			} else // No element - probably an anonymous load (i.e. $.batt.set(content))
				$.batt.set(set.content);
		});

		this.sets = [];
	},

	/**
	* Load generic Batt spec into an anonymous object
	* This will never actually appear. Its mostly used to load db-table widgets etc
	* @param string json The Batt object spec to load
	*/
	set: function(json) {
		var id = $.batt.getUniqueId('batt-form-');
		if ($.batt.isReady) {
			$.batt.forms[id] = new batt_form();
			$.batt.forms[id].type = 'form';
			$.batt.forms[id].set(json);
		} else { // Not yet ready
			console.log('Batt not yet ready. Defered load for anonymous object', id);
			$.batt.sets.push({
				content: json
			});
		}
	},

	find: function(id) {
		if ($.batt.forms[id]) // Is the ID an actual form?
			return $.batt.forms[id];

		for (var f in $.batt.forms) { // Nope. Recurse into each form
			var found = $.batt.forms[f].find(id);
			if (found)
				return found;
		}
		return null;
	},

	submit: function() {
		for (var f in $.batt.forms) {
			$.batt.forms[f].submit();
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
			console.log('Load script', this);
			var script = $(this);
			var scriptSrc = script.attr('src');
			if (scriptSrc) { // Has an src="path" attribute
				if ($.batt.loadScriptsSrc[scriptSrc] == 'loading') { // Still waiting for this script to load
					ready = 0;
				} else if ($.batt.loadScriptsSrc[scriptSrc] == 'loaded') { // Loaded content - this script is ready
					// Do nothing
				} else if (!$.batt.loadScriptsSrc[scriptSrc]) { // First mention of this script we've seen - trigger AJAX load
					$.batt.loadScriptsSrc[scriptSrc] = 'loading';
					$.ajax({
						url: scriptSrc,
						dataType: 'text',
						type: 'GET',
						data: {noheaders: 1},
						cache: true,
						success: function(html) {
							$.batt.loadScriptsSrc[scriptSrc] = 'loaded';
							script.replaceWith(html);
							$.batt.loadScripts();
						},
						error: function(jqxhr, errText, errThrown) {
							console.warn('Error while loading <script src="' + scriptSrc + '"/>', errText, errThrown); // FIXME: deal with this gracefully
						}
					});
					ready = 0;
				}
			} else { // Load from content
				var newId = $.batt.getUniqueId('batt-');
				script.before('<div id="' + newId + '"></div>')
				$.batt.loadScriptsInline.push('$(\'#' + newId + '\').batt(' + script.html() + ');');
				script.remove();
			}
		});
		if (ready) {
			$(window).on('error', function(e) {
				console.log('CAUGHT', e.originalEvent, $.batt.evalInfo);
				if ($.batt.evalInfo) { // We have something to complain about
					var box = $($.batt.evalInfo.id);
					var message = e.originalEvent.message.replace(/^Uncaught SyntaxError: /, '');
					var line = e.originalEvent.lineno;
					box.append('<div class="alert alert-block alert-error"><h3>Batt failed to load - ' + message + (line ? ' (Line: ' + line + ')' : '') + '</h3></div>');
					if (line) { // We have a specific line number to look at
						var block = $.batt.loadScriptsInline[$.batt.evalInfo.loadScriptsInlineOffset].split("\n");
						box.find('div.alert')
							.append($('<pre></pre>').text(block.slice(0, line - 1).join("\n")))
							.append('<div class="label label-warning">' + message + ':</div>')
							.append($('<pre class="alert"></pre>').text(block.slice(line - 1, line)))
							.append($('<pre></pre>').text(block.slice(line).join("\n")));
						
					} else { // We have no idea where the error occured
						box.find('div.alert').append(
							$('<pre></pre>').text($.batt.loadScriptsInline[$.batt.evalInfo.loadScriptsInlineOffset])
						);
					}
				}
			});
			for (var i = $.batt.loadScriptsInline.length - 1; i > -1; i--) {
				var matches = /\$\('(.*)'\)\.batt\(/.exec($.batt.loadScriptsInline[i]);
				$.batt.evalInfo = {
					loadScriptsInlineOffset: i,
					id: matches[1]
				};
				eval($.batt.loadScriptsInline[i]);
			}
			$.batt.evalInfo = null;
			$.batt.loadScriptsInline = [];
		} else {
			console.log('Inline <script> tags waiting on', Object.keys($.batt.loadScriptsSrc));
		}
	},

	// Utility functions {{{
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
}});

$.batt.ready();

$.fn.extend({
	batt: function(json) {
		return this.each(function() {
			var me = $(this);
			var id = me.attr('id');
			var content = json || me.text();
			if (!id) { // Make sure the item has an ID - make one if necessary
				id = $.batt.getUniqueId('batt-form-');
				me.attr('id', id)
			}
			if ($.batt.isReady) {
				$.batt.forms[id] = new batt_form();
				$.batt.forms[id].type = 'form';
				$.batt.forms[id].set(content);
				$.batt.forms[id].element = me;
				$.batt.forms[id].render.call($.batt.forms[id]);
			} else { // Not yet ready
				console.log('Batt not yet ready. Defered load for form', id);
				$.batt.sets.push({
					element: me,
					content: content
				});
			}
		});
	}
});

// Trigger initial sweep for <script type="batt"/> tags
$($.batt.loadScripts);
