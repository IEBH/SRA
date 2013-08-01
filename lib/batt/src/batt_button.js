function batt_button(parameters) {
	$.extend(this, {
		super: new batt_link(),
		containerDraw: 'buttons',
		action: 'nothing',
		class: 'btn',
		render: function() {
			this.super.render.call(this);
		}
	}, parameters);

	return this;
}
batt_button.prototype = new batt_link();
