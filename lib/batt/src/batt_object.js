function batt_object(parameters) {
	$.extend(this, {
		id: null,
		value: null,
		default: null,
		element: null,
		containerDraw: 'with-label',
		uses: null,

		// Dummy functions
		validate: function() { return true; },
		render: function() { return true; },

		loadData: function() {
			if (this.data && this.data[this.id]) { // Is there anything in the data stream?
				this.value = this.data[this.id];
				this.dataBinding = this.id + '.' + this.data['_table_'] + '#' + this.data['_id_'];
			} else if (this.default) { // Is there a default value?
				this.value = this.default;
			} else { // Found nothing - set to null
				this.value = null;
			}
		}
	});

	return this;
}
