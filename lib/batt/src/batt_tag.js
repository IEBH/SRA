function batt_tag(parameters) {
	$.extend(this, {
		super: new batt_link(),
		containerDraw: 'normal',
		action: 'nothing',
		classes: 'badge',
		render: function() {
			this.super.render.call(this);
		}
	}, parameters);

	return this;
}
batt_tag.prototype = new batt_link();
