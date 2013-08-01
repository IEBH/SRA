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
	hasInit: null,
	isReady: false,
	sets: [],

	tables: {},

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
