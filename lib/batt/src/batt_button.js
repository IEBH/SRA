function batt_button(parameters) {
	$.extend(this, {
		super: new batt_link(),
		containerDraw: 'buttons',
		action: 'nothing',
		classes: 'btn',
		render: function() {
			this.super.render.call(this);
			return this;
		}
	}, parameters);

	return this;
}
batt_button.prototype = new batt_link();
