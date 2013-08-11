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
						title: 'View',
						action: '/libraries/view/{{data._id}}'
					},
					{
						title: 'Edit',
						action: '/libraries/edit/{{data._id}}'
					},
					{
						title: 'Detect duplicates',
						action: '/libraries/dupes/{{data._id}}'
					},
					{
						title: 'Delete',
						action: '/libraries/delete/{{data._id}}'
					},
				]
			},
			{
				type: 'link',
				title: 'Title',
				text: "{{data.title}}",
				action: '/libraries/view/{{data._id}}'
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
