function batt_link(parameters) {
	$.extend(this, {
		text: 'A link',
		containerDraw: 'normal',
		action: 'nothing',
		class: null,
		render: function() {
			this.text = '<a href="' + this.action + '">' + (this.text || this.title) + '</a>';
			this.element = $(Mustache.render(this.text, this));
			var action = Mustache.render(this.action, this);
			
			if (this.class)
				this.element.addClass(this.class);

			switch (action) {
				case 'nothing':
					this.element.click(function(event) {
						event.preventDefault();
						alert('No action is assigned to this button');
					});
					break;
				case 'save':
				case 'submit':
					this.element.click(function(event) {
						event.preventDefault();
						$.batt.submit();
					});
					break;
				default: // Assign as href link
					this.element.attr('href', action);
			}
		}
	}, parameters);

	return this;
}
batt_link.prototype = new batt_object();
