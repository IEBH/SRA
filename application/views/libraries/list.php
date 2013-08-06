<script type="batt" src="/batt/schema"></script>
<script type="batt">
[
	{
		type: 'heading',
		title: 'Manage your libraries'
	},
	{
		uses: 'libraries',
		type: 'table',
		dataSource: {
			table: 'libraries',
			filter: {},
		},
		columns: [
			{
				type: 'dropdown',
				children: [
					{
						title: 'Edit',
						action: '/libraries/edit/{{data.id}}'
					},
					{
						title: 'Delete',
						action: '/libraries/delete/{{data.id}}'
					},
				]
			},
			{
				type: 'link',
				title: 'Title',
				text: "{{data.title}}",
				action: '/libraries/edit/{{data.id}}'
			}
		]
	},
	{
		type: 'button',
		action: '/libraries/create',
		text: '<i class="icon-plus"></i> Create new library',
		class: 'btn btn-success'
	}
]
</script>
