module.exports = function(parameters) {
	$.extend(this, {
		containerDraw: 'normal',
		implyChild: 'link',
		text: '<i class="icon-align-justify"></i>',
		columnTitle: '&nbsp;',
		columnWidth: '50px',
		renderTag: '<div class="dropdown"></div>',

		setup: function() {
			this.element = $(this.renderTag);
			return this;
		},

		render: function() {
			var me = this;
			if (!me.childrenOrder.length) { // If no order is specified just use the order of the hash (which will be alphabetical in most cases - also probably wrong)
				me.childrenOrder = Object.keys(me.children);
				console.warn('No childrenOrder specified. Inheriting from children hash in hash order instead', me);
			}

			var ddButton = $('<a class="btn" data-toggle="dropdown">' + (me.text || me.title) + '</a>')
				.appendTo(me.element);

			var ddItems = $('<ul class="dropdown-menu"></ul>')
				.appendTo(me.element);

			for (var c in me.childrenOrder) {
				var child = me.children[me.childrenOrder[c]];
				if (child.title == '-' || child.text == '-') { // Child is actually a seperator
					ddItems.append($('<li class="divider"></li>'));
				} else { // Child is a real boy!
					var childWrapper = $('<li></li>');
					child.render();
					childWrapper.append(child.element);
					ddItems.append(childWrapper);
				}
			}
			return this;
		}
	}, parameters);

	return this;
};
