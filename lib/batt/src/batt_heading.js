module.exports = function(parameters) {
	$.extend(this, {
		containerDraw: 'span',
		title: 'A heading',
		renderTag: '<legend></legend>',

		setup: function() {
			this.element = $(this.renderTag);
			return this;
		},

		render: function() {
			this.element.html(this.title);
			return this;
		}
	}, parameters);

	return this;
};
