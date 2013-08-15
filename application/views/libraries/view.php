<script type="batt" src="/batt/schema"></script>
<script type="batt">
[
	{
		type: 'heading',
		title: 'Manage your references'
	},
	{
		uses: 'references',
		type: 'table',
		dataSource: {
			table: 'references',
			filter: {},
		},
		columns: [
			{
				type: 'dropdown',
				text: '<i class="icon-tag"></i>',
				children: [
					{
						title: 'Edit',
						action: '/reference/edit/{{data._id}}'
					},
					{
						title: 'Delete',
						action: '/reference/delete/{{data._id}}'
					}
				]
			},
			{
				type: 'link',
				title: 'Title',
				text: "{{data.title}}",
				action: '/reference/edit/{{data._id}}'
			},
			{
				type: 'container_splitter',
				title: 'Authors',
				target: '{{data.authors}}',
				splitOn: ' AND ',
				splitInto: 'author',
				splitBetween: ' ',
				children: [
					{
						containerDraw: 'row',
						type: 'tag',
						classes: 'badge badge-info',
						text: '<i class="icon-user"></i> {{data.author}}',
						action: '/reference/edit/{{data._id}}'
					}
				]
			}
		]
	}
]
</script>
