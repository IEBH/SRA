function batt_heading(parameters) {
	$.extend(this, {
		containerDraw: 'span',
		title: 'A heading',
		renderTag: '<legend></legend>',

		setup: function() {
			this.element = $(this.renderTag);
		},

		render: function() {
			this.element.html(this.title);
		}
	}, parameters);

	return this;
}
batt_heading.prototype = new batt_object();
