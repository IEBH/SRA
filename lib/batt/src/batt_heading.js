function batt_heading(parameters) {
	$.extend(this, {
		containerDraw: 'span',
		title: 'A heading',
		render: function() {
			this.element = $('<legend>' + this.title + '</title>');
		}
	}, parameters);

	return this;
}
batt_heading.prototype = new batt_object();
