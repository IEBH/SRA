var simpleJsonFilter = require('simple-json-filter');

module.exports = function(parameters) {
	$.extend(this, {
		url: '/batt/api/feed',
		key: 'id',
		order: 'id',
		table: null, // Override if the remote table doesnt match this objects id
		fussy: 'auto', // Apply filters to incomming JSON stream (i.e. dont trust the server to return the right data). True, false or "auto" (true if url ends with '.json')

		/**
		* Initialize all child fields
		* This function also relocates this field into batt.feeds outside of the usual tree structure
		*/
		set: function(json) {
			if (this.table)
				this.table = this.id;
			this.super.set.call(this, json);
			return this;
		},

		/**
		* Retrieve some data based on a given filter + this.filter
		* @param array filter Hash of filters to use (basicly the SQL WHERE condition)
		* @param array fields The fields to retrieve
		* @param function success The success callback function. Called with function(json)
		* @param function fail The failed callback function. Called with function(errText, errThrown)
		* @return object This chainable object
		*/
		getData: function(dataSource, success, fail) {
			var me = this;
			$.ajax({
				url: me.url,
				dataType: 'json',
				type: 'POST',
				cache: false,
				data: {
					action: 'get',
					key: me.key,
					order: me.order,
					table: me.table || me.id,
					joins: dataSource.joins,
					filters: dataSource.filters,
					fields: dataSource.fields
				},
				success: function(json) {
					if 
					if (
						me.fussy
						|| (me.fussy == 'auto' && /\.json$/.exec(me.url)) // me.fussy==auto (and the URL ends with .json)
					) {
						var sjf = new simpleJsonFilter;
						json.payload = sjf
							.filter(dataSource.filters)
							.data(json.payload)
							.limit(dataSource.limit)
							.wantArray()
							.exec();
					}
					success(json);
				},
				error: function(jqxhr, errText, errThrown) {
					console.warn('Error while pulling data', errText, errThrown); // FIXME: deal with this gracefully
					fail(errText, errThrown);
				}
			});
			return this;
		},

		/**
		* Save data back to the Batt data feed
		* @param array filter Hash of filters to use (basicly the SQL WHERE condition)
		* @param array fields The fields to set for the given fitler
		* @param function success The success callback function. Called with function(json)
		* @param function fail The failed callback function. Called with function(errText, errThrown)
		* @return object This chainable object
		*/
		setData: function(dataSource, data, success, fail) {
			var me = this;
			$.ajax({
				url: me.url,
				dataType: 'json',
				type: 'POST',
				cache: false,
				data: {
					action: 'set',
					key: me.key,
					table: me.table || me.id,
					filters: dataSource.filters,
					fields: data
				},
				success: function(json) {
					success(json);
				},
				error: function(jqxhr, errText, errThrown) {
					console.warn('Error while setting data', errText, errThrown); // FIXME: deal with this gracefully
					fail(errText, errThrown);
				}
			});
			return this;
		}
	}, parameters);

	return this;
};
