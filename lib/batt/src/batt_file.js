module.exports = function(parameters) {
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
						var addChild = true;
						// FIX: Dont add any more children if the last item in the sequence doesn't have a value - This is to fix the issue where changing an existing file upload box would keep adding children to the end of the container parent {{{
						var originalElement = me;
						while (originalElement.cloneOf) // This element is actually a clone - find the original
							originalElement = batt.find(originalElement.cloneOf);

						var myParent = me.parent();
						var children = $.extend([], myParent.childrenOrder);
						children.reverse();
						for (var c in children) {
							var child = myParent.children[children[c]];
							if (child.cloneOf == originalElement.id) {
								console.log('FOUND FIRST CLONE', child.id);
								if (!child.value)
									addChild = false;
								break;
							}
						}
						// }}}
						if (addChild)
							me.parent()
								.addChild($.extend({}, me, {
									id: batt.getUniqueId(me.id),
									value: null,
									cloneOf: originalElement.id
								}), 'after', me.id)
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
};
