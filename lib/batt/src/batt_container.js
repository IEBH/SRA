function batt_container(parameters) {
	$.extend(this, {
		children: {},
		childrenOrder: [],
		containerDraw: 'row',
		implyChild: 'unknown', // Default to this if no child type is specified
		dataSource: null, // What data source to use (usually a hash structure)
		renderTag: '<div></div>', // What wrapper to use when drawing the container

		/**
		* Runs a function on each child of this container
		* This function is recursive. If you require just the immediate children use $.each(container.children, function() { })
		* @param callback callback The callback function to run. Called in the format function() {} setting 'this' to the current context
		* @param hash options A hash of options to use when filtering
		* @param object object Context object (internal use only)
		*/
		eachChild: function(callback, options, context) {
			if (!context)
				context = this;
			if (!context.children)
				return;

			var settings = $.extend({}, {
				andSelf: false
			}, options);

			if (settings.andSelf)
				callback.call(context);

			if (!context.childrenOrder)
				context.childrenOrder = Object.keys(context.children);

			for (var cid in context.childrenOrder) {
				var child = context.children[context.childrenOrder[cid]];
				callback.call(child);
				if (child.children)
					this.eachChild.call(child, callback, options, child);
			};
		},

		find: function(id, context) {
			if (!context)
				context = this;

			if (!context.children)
				return;

			if (context.children[id])
				return context.children[id];

			for (var c in context.children) {
				var found = this.find(id, context.children[c]);
				if (found)
					return found;
			};
		},

		/**
		* Extract all 'uses' directives from a complexly nested JSON object and return as an array
		* @param object json The nested JSON object to process
		* @return array An array of all uses directives
		*/
		determineUses: function(json) {
			var uses = {};

			var usesWorker = function(json, uses) { 
				$.each(json, function(i, j) {
					if (j.children)
						usesWorker(j.children, uses)
					if (j.uses)
						uses[j.uses] = 1;
				});
			}
			
			usesWorker(json, uses);
			return Object.keys(uses);
		},

		set: function(json, isChild) {
			var children = {};
			var childrenOrder = [];

			// Prevent race condition - processing tree before child.uses module loads are ready {{{
			if (!isChild) { // Master parent has already been invoked - we are propbably inside a recursive load
				var nonLoadedUses = [];
				var loads = this.determineUses(json);
				for (var l in loads) {
					console.log('REQUIRES', loads[l], $.batt.tables[loads[l]]);
					if (!$.batt.tables[loads[l]]) {
						console.log('NOT FOUND', loads[l]);
						nonLoadedUses.push($.batt.usesPath + loads[l]);
					}
				}
				if (nonLoadedUses.length) {
					console.log('Defer loading into ', json, ' wait for modules:', nonLoadedUses);
					var me = this;
					$script(nonLoadedUses[0], function(notFound) {
						console.log('LOADED MODULES', nonLoadedUses, notFound);
						me.set(json);
						me.render();
					}, function(notFound) {
						console.warn('CANNOT LOAD MODULES', notFound);
					});
					return;
				}
			}
			// }}}

			var me = this;
			$.each(json, function(i, obj) {
				var child = null;

				if (!obj.uses) // Inherit 'uses' from parent if not specified
					obj.uses = me.uses;

				if (!obj.type && obj.uses && obj.id && $.batt.tables[obj.uses].children[obj.id]) { // No type explicit but it looks like we are inheriting
					child = $.batt.tables[obj.uses].children[obj.id];
				} else { // Type explicit OR no uses
					switch (obj.type ? obj.type : me.implyChild) {
						case 'string':
							child = new batt_string();
							break;
						case 'number':
							child = new batt_number();
							break;
						case 'text':
							child = new batt_text();
							break;
						case 'choice':
							child = new batt_choice();
							break;
						case 'choice_radio':
							child = new batt_choice_radio();
							break;
						case 'date':
							child = new batt_date();
							break;
						case 'html':
							child = new batt_html();
							break;
						case 'button':
							child = new batt_button();
							break;
						case 'container':
							child = new batt_container();
							break;
						case 'dropdown':
							child = new batt_dropdown();
							break;
						case 'table':
							child = new batt_table();
							break;
						case 'tabs':
							child = new batt_tabs();
							break;
						case 'link':
							child = new batt_link();
							break;
						case 'heading':
							child = new batt_heading();
							break;
						case 'file':
							child = new batt_file();
							break;
						case 'db-table':
							child = new batt_db_table();
							break;
						case 'unknown':
						default:
							child = new batt_unknown();
							obj.typeFailed = obj.type;
							obj.type = 'unknown';
					}
				}

				if (!obj.id) { // Set up an ID - even if one doesnt already exist
					obj.id = $.batt.getUniqueId('field-');
					obj.idFake = true;
				} else if (!obj.idFake && !obj.title) // Set up nice looking title if done doesnt exist
					obj.title = obj.id.charAt(0).toUpperCase() + obj.id.substr(1);

				if (obj.uses && $.batt.tables[obj.uses] && $.batt.tables[obj.uses].children[obj.id]) { // Uses is something AND there is a table/col pair matching this definition - inheirt from base class + table + options
					child = $.batt.tables[obj.uses].children[obj.id];
					child.dataBinding = obj.uses + '.' + obj.id;
					$.extend(child, obj);
				} else // No uses directive - just inherit from base class + options
					$.extend(child, obj);

				childrenOrder.push(child.id);
				children[child.id] = child;

				if (child.children) // Initalize all children
					child.set(child.children, true);
			});

			this.children = children;
			this.childrenOrder = childrenOrder;
		},

		getData: function() {
			if (!this.dataSource) {
				console.warn('batt_container> Asked to getData() but no dataSource specified');
			} else {
				this.dataSource.dataRowOffset++;
				if (this.dataSource.data && this.dataSource.data.payload && this.dataSource.dataRowOffset < this.dataSource.data.payload.length) {
					this.data = this.dataSource.data.payload[this.dataSource.dataRowOffset];
					this.data['_table_'] = this.dataSource.table;
					return this.data;
				} else {
					return 0;
				}
			}
		},

		/**
		* Tell the container dataSource to load its data
		* @param callback success Function to call when data load has completed
		*/
		loadContainerData: function(success) {
			if (!$.batt.tables[this.dataSource.table]) {
				console.warn('Requested data from dataSource "' + this.dataSource.table + '" that is not loaded as a db-table type!');
			} else if (!$.batt.tables[this.dataSource.table].interface) {
				console.warn('Requested data from dataSource "' + this.dataSource.table + '" but no interface is specified');
			} else if (!this.dataSource.data) { // Data not already loaded
				var me = this;
				$.ajax({
					url: $.batt.tables[me.dataSource.table].interface,
					dataType: 'json',
					type: 'POST',
					cache: false,
					data: {
						key: $.batt.tables[me.dataSource.table].key,
						order: $.batt.tables[me.dataSource.table].order,
						table: me.dataSource.table,
						fields: Object.keys($.batt.tables[me.dataSource.table].children).join(',')
					},
					success: function(json) {
						me.dataSource.data = json;

						if (me.dataSource.limit) // Limit incomming data
							me.dataSource.data.payload = me.dataSource.data.payload.slice(0, me.dataSource.limit);

						me.dataSource.dataRowOffset = -1;
						//if (me.element)
						//	me.element.find('.batt-loading').remove();
						me.render();
					},
					error: function(jqxhr, errText, errThrown) {
						console.warn('Error while pulling data', errText, errThrown); // FIXME: deal with this gracefully
						me.element.find('.batt-loading').remove();
						me.element.append('<div class="alert">Error loading data: ' + errText + ' - ' + errThrown + '</div>');
					}
				});
				return;
			} else { // Render children with data
				success();
			}
		},

		render: function() {
			if (!this.element)
				this.element = $(this.renderTag);

			if (!this.childrenOrder || !this.childrenOrder.length) { // If no order is specified just use the order of the hash (which will be alphabetical in most cases - also probably wrong)
				if (!this.children) {
					console.warn('batt_container> Told to render but I have no children!', this);
					return;
				}
				this.childrenOrder = Object.keys(this.children);
				console.warn('No childrenOrder specified. Inheriting from children hash in hash order instead', this);
			}

			if (this.dataSource) {
				var me = this;
				this.loadContainerData(function() {
					var data;
					while (data = me.getData()) {
						// Copy this data into all children
						me.eachChild(function() {
							this.data = data;
						});

						for (var i in me.childrenOrder) {
							var child = me.children[me.childrenOrder[i]];
							child.element = $('<div></div>');
							child.loadData();
							child.render();

							me.renderRow(me.element, child);
						}
					}
				});
			} else { // No data to care about
				for (var c in this.childrenOrder) {
					var child = this.children[this.childrenOrder[c]];
					child.element = $('<div></div>');
					child.loadData();
					child.render();

					this.renderRow(this.element, child);
				}
			}
		},

		renderRow: function(element, child) {
			if (!element) {
				console.warn('renderRow of none-existant element for child', child);
				return;
			}

			switch (child.containerDraw) { // Which method to use when drawing the field?
				case 'debug':
					element.append('<div>DEBUG CHILD</div>');
					break;
				case 'table-cell':
					var field = $('<td></td>');
					field.append(child.element);
					element.append(field);
					break;
				case 'row':
				case 'entire-row': // Dont try to do anything
					element.append(child.element);
					break;
				case 'span': // Expand over the row but with spacing
					var field = $('<div></div>');
					field.first().append(child.element); // Load the child into the .controls div
					element.append(field);
					break;
				case 'buttons': // Draw as button group
					var field = $(
						'<div class="form-actions" style="padding-left: 0px; text-align: center">'
						+ '<div class="text-center"></div>'
						+ '</div>'
					);
					field.children('div').append(child.element); // Load the child into the .controls div
					element.append(field);
					break;
				case 'hide-label': // Draw in usual place but without a label
					var field = $(
						'<div class="control-group">'
						+ '<div class="controls"></div>'
						+ '</div>'
					);
					field.find('.controls').append(child.element); // Load the child into the .controls div
					element.append(field);
					break;
				case 'normal':
				case 'with-label': // Wrap child in the usual fluff - label + input area
				default:
					var field = $(
						'<div class="control-group">'
						+ '<label class="control-label">' + (child.title || child.id) + '</label>'
						+ '<div class="controls"></div>'
						+ '</div>'
					);
					field.find('.controls').append(child.element); // Load the child into the .controls div
					element.append(field);
			}
		},

		validate: function() {
			return this.validateChildren.call(this);
		},

		validateChildren: function() {
			var errors = {};
			for (var c in this.childrenOrder) {
				var id = this.childrenOrder[c];
				var child = this.children[id];
				var result = child.validate();
				if (typeof result == 'string') {
					errors[id] = result;
				} else if (typeof result == 'array') {
					$.extend(errors, result);
				} else if (typeof result == 'boolean') {
					errors[id] = 'Something went wrong';
				}
			}
			return errors;
		}
	}, parameters);

	return this;
}
batt_container.prototype = new batt_object();
