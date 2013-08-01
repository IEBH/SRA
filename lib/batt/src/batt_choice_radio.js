function batt_choice_radio(parameters) {
	$.extend(this, {
		choices: {},
		render: function() {
			var me = this;
			this.element = $('<div></div>');

			for (var id in this.choices) {
				this.element.append('<label class="radio"><input type="radio" name="' + me.id + '" value="' + id + '">' + this.choices[id] + '</label>');
			}

			if (this.value)
				this.element.find('input[value="' + this.value + '"]').prop('checked', true);
		}
	}, parameters);

	return this;
}
batt_choice_radio.prototype = new batt_object();
