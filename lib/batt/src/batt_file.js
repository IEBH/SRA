function batt_file(parameters) {
	$.extend(this, {
		text: '<i class="icon-file"></i> Select file...',
		classes: 'btn',
		textUploading: '<i class="icon-file icon-white"></i> {{value}}',
		classesUploading: 'btn btn-success',
		renderTag: '<div><div style="display: none"><input type="file"/></div><a></a></div>',
		autoDuplicate: false,

		setup: function() {
			this.element = $(this.renderTag);
			return this;
		},

		render: function() {
			var me = this;
			var button = this.element.find('a')
				.on('click', function() {
					file.trigger('click');
				});
			var file = this.element.find('input[type=file]')
				.attr('name', me.id)
				.on('change', function() {
					me.render();
					if (me.autoDuplicate) {
						me.parent()
							.addChild($.extend({}, me, {id: $.batt.getUniqueId(me.id), value: null}), 'after', me.id)
							.render();
					}
				});
			if (file.val()) { // Has a file to upload
				me.value = file.val().replace(/\\/g,'/').replace( /.*\//,'');
				button
					.html(me.parse(me.textUploading))
					.removeClass(me.classes)
					.addClass(me.classesUploading);
			} else { // Nothing to upload but still has syling
				button
					.html(me.parse(me.text))
					.removeClass(me.classesUploading)
					.addClass(me.classes);
			}
			return this;
		}
	}, parameters);

	return this;
}
batt_file.prototype = new batt_object();
