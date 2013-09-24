module.exports = function(parameters) {
	$.extend(this, {
		renderTag: '<div></div>',
		choices: {},

		setup: function() {
			this.element = $(this.renderTag);
			return this;
		},

		render: function() {
			var me = this;

			this.element.empty();
			for (var id in this.choices) {
				var label = $('<label class="radio"></label>')
					.appendTo(this.element);
				var radio = $('<input type="radio" name="' + me.id + '" value="' + id + '">' + this.choices[id] + '</label>')
					.appendTo(label)
					.on('change', function() {
						me.value = $(this).val();
						me.change.call(me);
					});
			}

			if (this.value)
				this.element.find('input[value="' + this.value + '"]').prop('checked', true);
			return this;
		}
	}, parameters);

	return this;
};
