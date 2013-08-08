<script type="batt" src="/batt/schema"></script>
<script type="batt">
[
	{
		type: 'heading',
		title: 'Import an EndNode file'
	},
	{
		id: 'name',
		type: 'string',
		title: 'Name of library',
		xdefault: 'My Imported Library'
	},
	{
		id: 'file',	
		type: 'file',
		title: 'EndNote XML file'
	},
	{
		type: 'button',
		action: 'submit',
		text: '<i class="icon-plus"></i> Import library',
		classes: 'btn btn-success'
	}
]
</script>
