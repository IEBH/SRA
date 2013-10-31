module.exports = function(parameters) {
	$.extend(this, {
		containerDraw: 'hide-label',
		value: null, // Value can only be '0' or '1'

		required: false,
		readOnly: null,
		errorRequired: 'String required',

		change: function() {
			this.value = this.element.find('input[type=checkbox]').is(':checked') ? '1' : '0';
			this.super.change.call(this);
		},

		setup: function() {
			var me = this;
			me
				.element = $('<label class="checkbox"><input type="checkbox"/> ' + me.title + '</label>')
				.on('change', function() {
					me.change.call(me);
				});
			return me;
		},

		render: function() {
			var me = this;
			if (me.value) {
				me.element.attr('checked', 'checked');
				me.value = '1';
			} else {
				me.element.removeAttr('checked');
				me.value = '0';
			}

			if (me.readOnly)
				me.element
					.attr('readonly', 'readonly')

					.addClass('disabledInput');
			return me;
		},

		validate: function() {
			if (this.required && !this.value)
				return this.errorRequired;
		}
	}, parameters);

	return this;
};
