function batt_table(parameters) {
	$.extend(this, {
		super: new batt_container(),
		columns: {}, // Where the raw objects used to generate the children reside
		columnOrder: [],

		refresh: function(callback) {
			if (!this.columnOrder.length) { // If no order is specified just use the order of the hash (which will be alphabetical in most cases - also probably wrong)
				this.columnOrder = Object.keys(this.columns);
				console.warn('No columnOrder specified. Inheriting from columns hash in hash order instead', this);
			}

			if (!this.element)
				this.element = $('<div class="well"><h3>Loading table...</h3></div>');

			if (!this.dataSource) {
				console.log('batt_table> No dataSource specified - What did you want me to render exactly?');
			} else {
				var me = this;
				this.loadContainerData(function() {
					// Kill all children and regenerate
					me.children = {};
					me.childrenOrder = [];

					var data;
					while (data = me.getData()) {
						var rowId = $.batt.getUniqueId('batt-table-row-');
						me.children[rowId] = new batt_container();
						me.children[rowId].renderTag = '<tr></tr>';
						me.childrenOrder.push(rowId);

						me.children[rowId].set(me.columns); // Copy column prototype into new child

						for (var c in me.children[rowId].children) {
							me.children[rowId].children[c].containerDraw = 'table-cell';
						}

						me.children[rowId].eachChild(function() { // Copy data hash into children
							this.data = data;
						});
					}
					callback();
				});
			}
		},

		render: function() {
			var me = this;
			this.refresh(function() {
				var table = $('<table class="table table-bordered table-striped"></table>');
				var tableHead = $('<tr></tr>')
					.appendTo(table);
				for (var c in me.columnOrder) {
					var child = me.columns[me.columnOrder[c]];
					var tableCell = $('<th>' + (child.columnTitle || child.title || '&nbsp;') + '</th>')
						.appendTo(tableHead);
					if (child.columnWidth)
						tableCell.attr('width', child.columnWidth);
				}

				for (var c in me.childrenOrder) {
					var child = me.children[me.childrenOrder[c]];
					child.loadData();
					child.render();
					child.element.appendTo(table);
				}
				me.element.replaceWith(table);
			});
		}
	}, parameters);

	return this;
}
batt_table.prototype = new batt_container();
