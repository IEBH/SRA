function batt_db_table(parameters) {
	$.extend(this, {
		super: new batt_container(),
		set: function(json) {
			this.super.set.call(this, json);
			console.log('Loaded DB table "' + this.id + '"');
			$.batt.tables[this.id] = $.extend({}, this);
			this.children = {};
			this.childrenOrder = [];
		}
	}, parameters);

	return this;
}
batt_db_table.prototype = new batt_container();
