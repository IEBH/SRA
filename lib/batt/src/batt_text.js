function batt_text(parameters) {
	$.extend(this, {
		render: function() {
			this
				.element = $('<textarea></textarea>')
				.html(this.value)
				.on('change', this.change);
		}
	}, parameters);

	return this;
}
batt_text.prototype = new batt_input();
