module.exports = function(parameters) {
	$.extend(this, {
		setup: function() {
			this.super.setup.call(this);
			this.element.attr('type', 'email');
		},

		render: function() {
			this.super.render.call(this);
			return this;
		}
	}, parameters);

	return this;
};
