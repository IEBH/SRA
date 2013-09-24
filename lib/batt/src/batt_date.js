module.exports = function(parameters) {
	$.extend(this, {
		renderTag: '<div class="form-inline"></div>',
		showDate: true,
		showTime: true,
		readOnly: false,

		setup: function() {
			this.element = $(this.renderTag);
			return this;
		},

		render: function() {
			if (this.showDate)
				this.element.append('<div class="input-prepend"><span class="add-on"><i class="icon-calendar"></i></span><input type="date" class="input-medium"/></div>');

			if (this.showDate && this.showTime)
				this.element.append('&nbsp;');

			if (this.showTime)
				this.element.append('<div class="input-prepend"><span class="add-on"><i class="icon-time"></i></span><input type="time" class="input-small"/>');

			if (this.readOnly)
				this.element.find('input')
					.attr('readonly', 'readonly')
					.addClass('disabledInput');
			return this;
		}
	}, parameters);

	return this;
};
