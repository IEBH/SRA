function batt_file(parameters) {
	$.extend(this, {
		text: '<i class="icon-file"></i> Select file...',
		classes: 'btn',
		textUploading: '<i class="icon-file-alt"></i> {{value}}',
		classesUploading: 'btn btn-success',
		render: function() {
			this.element = $('<div><div style="display: none"></div></div>');
			var me = this;
			var file = $('<input type="file"/>')
				.attr('name', me.id)
				.appendTo(me.element.find('div'))
				.on('change', function() {
					me.value = file.val().replace(/\\/g,'/').replace( /.*\//,'');
					button
						.html(me.parse(me.textUploading))
						.removeClass(me.classes)
						.addClass(me.classesUploading);
				});
			var button = $('<a></a>')
				.appendTo(me.element)
				.html(this.text)
				.on('click', function() {
					file.trigger('click');
				});
			if (me.classes)
				button.addClass(me.classes);
		}
	}, parameters);

	return this;
}
batt_file.prototype = new batt_object();
