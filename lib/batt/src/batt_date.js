function batt_date(parameters) {
	$.extend(this, {
		showDate: true,
		showTime: true,
		readOnly: false,
		render: function() {
			this.element = $('<div class="form-inline"></div>');
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
		}
	}, parameters);

	return this;
}
batt_date.prototype = new batt_object();
