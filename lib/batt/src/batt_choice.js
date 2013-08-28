function batt_choice(parameters) {
	$.extend(this, {
		renderTag: '<select></select>',
		choices: {
			foo: 'Foo',
			bar: 'Bar',
			baz: 'Baz'
		},
		setup: function() {
			this.element = $(this.renderTag);
		},
		render: function() {
			this.element.empty();
			for (var id in this.choices) {
				this.element.append('<option value="' + id + '">' + this.choices[id] + '</option>');
			}

			if (this.value)
				this.element.val(this.value);
		}
	}, parameters);

	return this;
}
batt_choice.prototype = new batt_object();
