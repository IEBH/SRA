function batt_form(parameters) {
	$.extend(this, {
		super: new batt_container(),
		submit: function() {
			if (this.validate()) {
				console.log('SUBMIT> OK');
				var data = {};
				this.eachChild(function() {
					console.log(this);
					if (this.dataBinding)
						data[this.dataBinding] = this.value;
				});
				console.log('SAVE>', data);
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

			var outerForm = $('<form action="#" method="post" class="form-horizontal"></form>')
				.on('submit', this.submit)
				.appendTo(this.element);
			this.element = outerForm;
			this.super.render.call(this);
		}
	}, parameters);

	return this;
}
batt_form.prototype = new batt_container();
