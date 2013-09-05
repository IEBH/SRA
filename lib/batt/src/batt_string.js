function batt_string(parameters) {
	$.extend(this, {
		super: new batt_input(),

		render: function() {
			this.super.render.call(this);
			this.element.attr('type', 'text');
			return this;
		},
	}, parameters);

	return this;
}
batt_string.prototype = new batt_input();
