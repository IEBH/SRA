function batt_feed_batt(parameters) {
	$.extend(this, {
		super: new batt_feed(),

		url: '/batt/api/feed',
		key: 'id',
		order: 'id',
		table: null, // Override if the remote table doesnt match this objects id

		/**
		* Initialize all child fields
		* This function also relocates this field into $.batt.feeds outside of the usual tree structure
		*/
		set: function(json) {
			if (this.table)
				this.table = me.id;
			this.super.set.call(this, json);
		},

		/**
		* Retrieve some data based on a given filter + this.filter
		* @param array filter Hash of filters to use (basicly the SQL WHERE condition)
		* @param array fields The fields to retrieve
		* @param function success The success callback function. Called with function(json)
		* @param function fail The failed callback function. Called with function(errText, errThrown)
		*/
		getData: function(filter, fields, success, fail) {
			var me = this;
			$.ajax({
				url: me.url,
				dataType: 'json',
				type: 'POST',
				cache: false,
				data: {
					key: me.key,
					order: me.order,
					table: me.table,
					filter: $.extend({}, filter, me.filter),
					fields: fields
				},
				success: function(json) {
					success(json);
				},
				error: function(jqxhr, errText, errThrown) {
					console.warn('Error while pulling data', errText, errThrown); // FIXME: deal with this gracefully
					fail(errText, errThrown);
				}
			});
		},

		/**
		* Save data back to the Batt data feed
		* @param array filter Hash of filters to use (basicly the SQL WHERE condition)
		* @param array fields The fields to set for the given fitler
		* @param function success The success callback function. Called with function(json)
		* @param function fail The failed callback function. Called with function(errText, errThrown)
		*/
		setData: function(filter, data, success, fail) {
			console.warn('batt_db_feed> Asked to set data but no specific driver is setup');
		}
	}, parameters);

	return this;
}
batt_feed_batt.prototype = new batt_feed();
