function batt_tabs(parameters) {
	$.extend(this, {
		super: new batt_container(),
		default: 0, // The default tab offset to select

		render: function() {
			if (!this.childrenOrder.length) { // If no order is specified just use the order of the hash (which will be alphabetical in most cases - also probably wrong)
				this.childrenOrder = Object.keys(this.children);
				console.warn('No childrenOrder specified. Inheriting from children hash in hash order instead', this);
			}

			this.element = $('<div></div>');

			// Draw tab selection pane {{{
			var tabHead = $('<ul class="nav nav-tabs"></ul>')
				.appendTo(this.element);
			for (var c in this.childrenOrder) {
				var child = this.children[this.childrenOrder[c]];
				child.linkHash = $.batt.safeString(child.title);
				tabHead.append('<li><a href="#' + child.linkHash + '" data-toggle="tab">' + child.title + '</a></li>');
			}
			// }}}
			// Draw actual tabs {{{
			var tabBody = $('<div class="tab-content"></div>')
				.appendTo(this.element);
			for (var c in this.childrenOrder) {
				var child = this.children[this.childrenOrder[c]];
				child.render();
				var tabContent = $('<div class="tab-pane" id="' + child.linkHash + '"></div>')
					.appendTo(tabBody);
				this.renderRow(tabContent, child);
			}
			// }}}
			// Select default tab {{{
			tabHead.find('a[data-toggle="tab"]').eq(this.default).tab('show');
			tabBody.find('div.tab-pane').eq(this.default).addClass('active');
			// }}}
		}
	}, parameters);

	return this;
}
batt_tabs.prototype = new batt_container();
