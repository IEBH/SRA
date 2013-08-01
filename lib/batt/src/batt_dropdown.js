function batt_dropdown(parameters) {
	$.extend(this, {
		containerDraw: 'normal',
		implyChild: 'link',
		title: '<i class="icon-align-justify"></i>',
		columnTitle: '&nbsp;',
		columnWidth: '50px',
		render: function() {
			if (!this.childrenOrder.length) { // If no order is specified just use the order of the hash (which will be alphabetical in most cases - also probably wrong)
				this.childrenOrder = Object.keys(this.children);
				console.warn('No childrenOrder specified. Inheriting from children hash in hash order instead', this);
			}

			this.element = $('<div class="dropdown"></div>');

			var ddButton = $('<a class="btn" data-toggle="dropdown">' + this.title + '</a>')
				.appendTo(this.element);

			var ddItems = $('<ul class="dropdown-menu"></ul>')
				.appendTo(this.element);

			for (var c in this.childrenOrder) {
				var child = this.children[this.childrenOrder[c]];
				var childWrapper = $('<li></li>');
				child.render();
				childWrapper.append(child.element);
				ddItems.append(childWrapper);
			}
		}
	}, parameters);

	return this;
}
batt_dropdown.prototype = new batt_container();
