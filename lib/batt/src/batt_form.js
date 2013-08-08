function batt_form(parameters) {
	$.extend(this, {
		super: new batt_container(),
		method: 'POST', // POST - Regular HTML submit, BATT - internal AJAX calls to a Batt server
		action: '?', // If type=html this is the location where the form will be submitted.

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
							console.log(this);
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

		render: function() {
			if (!this.element) {
				console.log('batt_form> Told to render but with no parent element', this);
				return;
			}

			var outerForm = $('<form action="' + this.action + '" method="POST" class="form-horizontal" enctype="multipart/form-data"></form>')
				.appendTo(this.element);
			this.element = outerForm;
			this.super.render.call(this);
		}
	}, parameters);

	return this;
}
batt_form.prototype = new batt_container();
