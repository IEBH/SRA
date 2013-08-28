function batt_feed(parameters) {
	$.extend(this, {
		url: null,
		key: null,
		order: null,

		set: function(json) {
			var me = this;
			console.log('Loaded feed "' + me.id + '"');
			$.batt.feeds[me.id] = $.extend({}, me);
			$.each(json, function(i, obj) {
				$.batt.feeds[me.id].addChild(obj);
			});
			$.batt.find(me.id).parent().removeChild(me.id); // Remove self from object lists
		},

		setup: function() { // Do nothing - this element will be removed during set() anyway
			return;
		},

		render: function() { // As with setup() we dont draw this widget anyway
			return;
		},

		getData: function(filter, success, fail) {
			console.warn('batt_db_feed> Asked to get data but no specific driver is setup');
		},

		setData: function(filter, data, success, fail) {
			console.warn('batt_db_feed> Asked to set data but no specific driver is setup');
		}
	}, parameters);

	return this;
}
batt_feed.prototype = new batt_container();
