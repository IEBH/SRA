function batt_input(parameters) {
	$.extend(this, {
		placeholder: null,
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

		render: function() {
			var me = this;
			this
				.element = $('<input/>')
				.on('change', function() {
					me.change.call(me);
				});
			if (this.value)
				this.element.attr('value', this.value);
			if (this.placeholder)
				this.element.attr('placeholder', this.placeholder);
			if (this.readOnly)
				this.element
					.attr('readonly', 'readonly')
					.addClass('disabledInput');
			if (this.dataBinding)
				this.element.attr('batt-data-binding', this.dataBinding);
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
}

batt_input.prototype = new batt_object();
