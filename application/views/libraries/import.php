<script type="batt" src="/batt/schema"></script>
<script type="batt">
[
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
						action: 'form.php#{{data.id}}'
					},
					{
						title: 'Delete',
						action: 'FIXME#{{data.id}}'
					},
				]
			},
			{
				type: 'link',
				title: 'Title',
				text: "{{data.title}}",
				action: 'form.php#{{data.id}}'
			}
		]
	},
	{
		type: 'button',
		action: 'FIXME#',
		text: '<i class="icon-plus"></i> Create new Inpection Report',
		class: 'btn btn-success'
	}
]
</script>
