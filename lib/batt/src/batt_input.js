module.exports = function(parameters) {
	$.extend(this, {
		placeholder: null,
		classes: null,
		required: false,
		lengthMax: null,
		lengthMin: null,
		readOnly: null,
		errorRequired: 'String required',
		errorLengthMax: 'String too long',
		errorLengthMin: 'String too short',

		change: function() {
			this.value = this.element.val();
		},

		setup: function() {
			var me = this;
			me
				.element = $('<input/>')
				.on('change', function() {
					me.change.call(me);
				});
			return me;
		},

		render: function() {
			var me = this;
			if (me.value)
				me.element.attr('value', me.value);
			if (me.placeholder)
				me.element.attr('placeholder', me.placeholder);
			if (me.readOnly)
				me.element
					.attr('readonly', 'readonly')
					.addClass('disabledInput');
			if (me.dataBinding)
				me.element.attr('batt-data-binding', me.dataBinding);
			if (me.classes)
				me.element.addClass(me.classes);
			return me;
		},

		validate: function() {
			if (this.required && !this.value)
				return this.errorRequired;
			if (this.lengthMax && this.value.length > this.lengthMax)
				return this.errorLengthMax;
			if (this.lengthMin && this.value.length > this.lengthMin)
				return this.errorLengthMin;
		}
	}, parameters);

	return this;
};
