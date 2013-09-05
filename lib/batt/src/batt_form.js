function batt_form(parameters) {
	$.extend(this, {
		super: new batt_container(),
		method: 'POST', // POST - Regular HTML submit, BATT - internal AJAX calls to a Batt server
		action: '?', // If type=html this is the location where the form will be submitted.
		renderTag: '<form action="{{this.action}}" method="POST" class="form-horizontal" enctype="multipart/form-data"></form>',

		submit: function() {
			var me = this;
			if (me.validate()) {
				console.log('SUBMIT> OK');

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

		render: function(first) {
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
}
batt_form.prototype = new batt_container();
