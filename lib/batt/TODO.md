TODO LIST
=========
* Signature widget
* File upload widget
* `batt_number.between`
* `batt_object.sameAs` (for passwords)
* `batt_object.choices` (to constrain items to a preselected list)
* `batt_object.re` (constrain RegExp)


* BUGFIX: `batt_container` and `batt_container_splitter` virtually re-create children but not duplicate them like `batt_table` does
* BUGFIX: Doc example inherit duplicate values from parents even if overwriting (e.g. 'text', 'title')
* BUGFIX: Make `batt_table.children` ~= `batt_table.columns` if specified by the user
