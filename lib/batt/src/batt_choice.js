function batt_choice(parameters) {
	$.extend(this, {
		renderTag: '<select></select>',
		choices: {
			foo: 'Foo',
			bar: 'Bar',
			baz: 'Baz'
		},
		setup: function() {
			var me = this;
			me.element = $(me.renderTag);
			me.element.on('change', function() {
				me.value = $(this).val();
				me.change.call(me);
			});
		},
		render: function() {
			this.element.empty();
			for (var id in this.choices) {
				this.element.append('<option value="' + id + '">' + this.choices[id] + '</option>');
			}

			if (me.value) {
				me.element.val(me.value);
			} else { // No value - select the first
				me.element
					.val( me.element.find('option:first').attr('value') )
					.trigger('change');
			}
		}
	}, parameters);

	return this;
}
batt_choice.prototype = new batt_object();
