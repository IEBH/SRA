module.exports = function(parameters) {
	$.extend(this, {
		containerDraw: 'normal',
		action: 'nothing',
		classes: 'badge',
		render: function() {
			this.super.render.call(this);
		}
	}, parameters);

	return this;
};
