module.exports = function(parameters) {
	$.extend(this, {
		renderTag: '<textarea></textarea>',

		setup: function() {
			this.element = $(this.renderTag)
			return this;
		},

		render: function() {
			this.element
				.html(this.value)
				.on('change', this.change);
			return this;
		},

		change: function() {
			this.value = this.element.val();
			this.super.change.call(this);
		}
	}, parameters);

	return this;
};
