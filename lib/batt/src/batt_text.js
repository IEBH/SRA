function batt_text(parameters) {
	$.extend(this, {
		renderTag: '<textarea></textarea>',

		setup: function() {
			this.element = $(this.renderTag)
		},

		render: function() {
			this.element
				.html(this.value)
				.on('change', this.change);
		}
	}, parameters);

	return this;
}
batt_text.prototype = new batt_input();
