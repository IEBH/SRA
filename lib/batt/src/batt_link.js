function batt_link(parameters) {
	$.extend(this, {
		text: null,
		containerDraw: 'normal',
		action: 'nothing',
		classes: null,
		render: function() {
			var me = this;
			me.text = '<a href="' + me.action + '">' + (me.text || me.title || 'A link') + '</a>';
			me.element = $(me.parse(me.text));
			var action = me.parse(me.action);
			
			if (me.classes)
				me.element.addClass(me.classes);

			switch (action) {
				case 'nothing':
					me.element.click(function(event) {
						event.preventDefault();
						alert('No action is assigned to this button');
					});
					break;
				case 'save':
				case 'submit':
					me.element.click(function(event) {
						event.preventDefault();
						me.findParent('form').submit();
					});
					break;
				default: // Assign as href link
					me.element.attr('href', action);
			}
		}
	}, parameters);

	return this;
}
batt_link.prototype = new batt_object();
