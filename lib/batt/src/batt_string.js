function batt_string(parameters) {
	$.extend(this, {
		super: new batt_input()
	}, parameters);

	return this;
}
batt_string.prototype = new batt_input();
