module.exports = function(parameters) {
	$.extend(this, {
		render: function() {
			this.super.render.call(this);
			this.element.attr('type', 'text');
			return this;
		},
	}, parameters);

	return this;
};
