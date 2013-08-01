function batt_choice(parameters) {
	$.extend(this, {
		choices: {
			foo: 'Foo',
			bar: 'Bar',
			baz: 'Baz'
		},
		render: function() {
			this.element = $('<select></select>');

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
