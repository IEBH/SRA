module.exports = function(parameters) {
	$.extend(this, {
		containerDraw: 'normal',

		renderTag: '<select></select>',
		renderItem: '<option value="{{data._id}}">{{data.title}}</option>',

		setup: function() {
			var me = this;
			me.element = $(me.renderTag);
			me.element.on('change', function() {
				me.value = $(this).val();
				me.change.call(me);
			});
			return this;
		},

		render: function() {
			var me = this;
			me.loadContainerData(function() {
				var data;
				me.element.empty()
				me.rewindData();

				while (data = me.getData()) {
					me.element.append($(me.parse(me.renderItem)));
				}

				if (me.value) {
					me.element.val(me.value);
				} else { // No value - select the first
					me.element
						.val( me.element.find('option:first').attr('value') )
						.trigger('change');
				}
			});
			return this;
		}
	}, parameters);

	return this;
};
