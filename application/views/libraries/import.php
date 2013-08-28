<script type="batt" src="<?=SITE_ROOT?>batt/schema"></script>
<script type="batt">
[
	{
		type: 'heading',
		title: 'Import an EndNode file'
	},
	{
		id: 'where',
		type: 'choice_radio',
		title: 'Where to import',
		choices: {
			existing: 'Existing library',
			new: 'New library'
		},
		default: 'new'
	},
	{
		id: 'title',
		type: 'string',
		title: 'Name of new library',
		default: 'My Imported Library',
		showIf: {where: 'new'}
	},
	{
		id: 'libraryid',
		type: 'reference',
		to: 'libraries',
		title: 'Library to import to',
		showIf: {where: 'existing'}
	},
	{
		id: 'file',	
		type: 'file',
		title: 'EndNote XML file',
		autoDuplicate: true
	},
	{
		type: 'button',
		action: 'submit',
		text: '<i class="icon-plus"></i> Import library',
		classes: 'btn btn-success'
	}
]
</script>
