function batt_html(parameters) {
	$.extend(this, {
		super: new batt_object(),
		containerDraw: 'span',
		text: '<div class="alert alert-info">Hello World</div>',
		classes: null,
		render: function() {
			var html = this.text || this.title;
			if (html.substr(0, 1) != '<') // Doesn't already have a tag structure
				html = '<div>' + html + '</div>';

			this.element = $(this.parse(html));

			if (this.classes)
				this.element.addClass(this.classes);
		}
	}, parameters);

	return this;
}
batt_html.prototype = new batt_object();
