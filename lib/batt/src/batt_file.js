module.exports = function(parameters) {
	$.extend(this, {
		text: '<i class="icon-file"></i> Select file...',
		classes: 'btn',
		textUploading: '<i class="icon-file icon-white"></i> {{value}}',
		classesUploading: 'btn btn-success',
		renderTag: '<a></a>',
		autoDuplicate: false,

		setup: function() {
			var me = this;
			me.element = $(me.renderTag);
			me.element
				.on('click', function() {
					if (!me.fileInput) { // Never interacted with this file input before
						// NOTE: We have to put the <input type="file"/> elements in their own protected area so they dont get wiped on a batt_container.clear().
						// NOTE2: We have to put them in their own <div>, rather than just appending them, because the browser wont let us trigger the 'click' event unless they are visible - luckily the parent div can be hidden and the input element can be 'shown' to fool the browser into allowing this.
						var parentForm = me.findParent('form');
						var protectedArea = parentForm.element.children('.batt-protected');
						if (!protectedArea.length) // No existing protected area?
							protectedArea = $('<div class="batt-protected" style="display: none"></div>')
								.appendTo(parentForm.element);

						me.fileInput = $('<input type="file" class="batt-protected"/>')
							.attr('name', me.id)
							.on('change', function() {
								me.change.call(me);
							})
							.appendTo(protectedArea);
					}
					me.fileInput.trigger('click');
				});
			return me;
		},

		change: function() {
			var me = this;
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
							cloneOf: originalElement.id,
							fileInput: null
						}), 'after', me.id)
						.render();
			}
			me.super.change.call(me);
		},

		render: function() {
			var me = this;
			if (me.fileInput && me.fileInput.val()) { // Has a file to upload
				me.value = me.fileInput.val().replace(/\\/g,'/').replace( /.*\//,'');
				me.element
					.html(me.parse(me.textUploading))
					.removeClass(me.classes)
					.addClass(me.classesUploading);
			} else { // Nothing to upload but still has syling
				me.element
					.html(me.parse(me.text))
					.removeClass(me.classesUploading)
					.addClass(me.classes);
			}
			return this;
		}
	}, parameters);

	return this;
};
