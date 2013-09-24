module.exports = function(parameters) {
	$.extend(this, {
		method: 'POST', // POST - Regular HTML submit, BATT - internal AJAX calls to a Batt server
		action: '?', // If type=html this is the location where the form will be submitted.
		renderTag: '<form action="{{this.action}}" method="POST" class="form-horizontal" enctype="multipart/form-data"></form>',

		submit: function() {
			var me = this;
			if (me.validate()) {
				console.log('SUBMIT> OK');

				// Get all children which request from a dataSource {{{
				var dataSources = [];
				me.eachChild(function() {
					if (this.dataSource)
						dataSources.push(this);
				});
				// }}}
				// FIXME: Avoid peers being inside peers
				// For each dataSource... {{{
				for (var i in dataSources) {
					var data = {};
					var ds = $.extend({}, dataSources[i].dataSource);
					// Evaluate all filters {{{
					if (ds.filters) { // Parse all filter arguments
						var newFilters = {};
						for (var key in ds.filters) {
							newFilters[key] = me.parse(ds.filters[key]);
						}
						ds.filters = newFilters;
					}
					// }}}
					dataSources[i].eachChild(function() {
						if (
							(this.dataBinding) // Has a data binding
							&& (batt.feeds[dataSources[i].dataSource.feed]) // The feed this item is pointing at is valid
							&& (batt.feeds[dataSources[i].dataSource.feed].children[this.dataBinding]) // The feed recognizes this child
							&& (batt.feeds[dataSources[i].dataSource.feed].children[this.dataBinding].allowSet) // The feed says this child item can be set
						) {
							if (batt.feeds[dataSources[i].dataSource.feed].children[this.dataBinding].dataId) { // Use alternate internal name for the dataId
								data[batt.feeds[dataSources[i].dataSource.feed].children[this.dataBinding].dataId] = this.value;
							} else { // No alternate specified - just pass the ID
								data[this.dataBinding] = this.value;
							}
						}
					});
					batt.feeds[dataSources[i].dataSource.feed].setData(ds, data, function() {
						console.log('FIXME: SAVED!');
					}, function() {
						console.log('FIXME: SAVE FAILED!');
					});
				}
				// }}}


				/*
				switch (me.method.toUpperCase()) {
					case 'POST':
						me.eachChild(function() {
							if (!this.idFake)
								me.element.append('<input type="hidden" name="' + this.id + '" value="' + (this.value !== null ? this.value : '') + '"/>');
						});
						me.element.trigger('submit');
						break;
					case 'BATT':
						var data = {};
						me.eachChild(function() {
							if (this.dataBinding)
								data[this.dataBinding] = this.value;
						});
						console.warn('Batt submission not yet supported');
						console.log('SAVE>', data);
						break;
					default:
						alert('Unsupported form type: ' + me.method);
				}
				*/
			} else {
				console.log('SUBMIT> FAIL');
			}
			return false;
		},

		setup: function() {
			var me = this;
			var form = $(me.parse(me.renderTag));
			if (me.element) { // Has parent element - probably allocated by main batt.js process during creation
				var outerForm = $(me.parse(me.renderTag))
					.appendTo(me.element);
				me.element = outerForm;
			} else { // No existing element - probably a nested object
				me.element = form;
			}
			return this;
		},

		render: function() {
			var me = this;
			if (!me.element) {
				console.log('batt_form> Told to render but with no parent element', me);
				return;
			}

			me.super.render.call(me);
			me.eachChild(function() { // Calculate initial state of all showIf events
				this.changeOther(false);
			});
			return this;
		}
	}, parameters);

	return this;
};
