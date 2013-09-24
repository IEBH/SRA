module.exports = function(parameters) {
	$.extend(this, {
		min: null,
		max: null,
		decimals: 0,
		errorMin: 'Number too small',
		errorMax: 'Number too large',

		render: function() {
			this.super.render.call(this);
			this.element.attr('type', 'number');
			if (this.decimals)
				this.element.attr('step', 'any');
			if (this.min)
				this.element.attr('min', this.min);
			if (this.max)
				this.element.attr('max', this.max);
			return this;
		},

		validate: function() {
			this.super.validate.call(this);
			if (this.min && this.value < this.min)
				return this.errorMin;
			if (this.max && this.value > this.max)
				return this.errorMax;
		}
	}, parameters);

	return this;
};
