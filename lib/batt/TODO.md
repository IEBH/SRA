TODO LIST
=========
* BUGFIX: `batt_container` and `batt_container_splitter` virtually re-create children but not duplicate them like `batt_table` does
* BUGFIX: Doc examples inherit duplicate values from parents even if overwriting (e.g. 'text', 'title')
* BUGFIX: Make `batt_table.children` ~= `batt_table.columns` if specified by the user


Feature requests
================
* `batt_picture`
	- Ability to take pictures using WebCam
	- Signature widget
* `batt_choice_radio` / `batt_choice_checkbox`
	- Border around elements - possibly color this red on validation fail
* `batt_choice_checkbox`
	- Actually implement this interface
	- Add `.min` and `.max` properties (i.e. must select at least '3' no more than '5')
* `batt_number`
	- `.between` (e.g. '5 and 10') - should use preg_match('/^\s*(0-9\.+?).*?(0-9\.+)$/') to extract range
* `batt_object`
	- `.sameAs` (e.g. for passwords)
	- `.choices` (to constrain items to a preselected list)
	- `.re` (to constrain to RegExp)
* `batt_wizard`
	- Actually implement this interface - basicly a container with a set of steps
