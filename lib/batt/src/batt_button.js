module.exports = function(parameters) {
	$.extend(this, {
		containerDraw: 'buttons',
		action: 'nothing',
		classes: 'btn',
		render: function() {
			this.super.render.call(this);
			return this;
		}
	}, parameters);

	return this;
};
