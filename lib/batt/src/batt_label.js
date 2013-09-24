module.exports = function(parameters) {
	$.extend(this, {
		text: null,
		containerDraw: 'normal',
		classes: null,

		setup: function() {
			this.element = $('<label class="checkbox"></label>'); // Odd that Bootstrap has no other way of having non-weird looking form text
			return this;
		},

		render: function() {
			var me = this;
			me.element.html(me.parse(me.text || me.title || 'A label'));
			
			if (me.classes)
				me.element.addClass(me.classes);
			return this;
		}
	}, parameters);

	return this;
};
