<script type="batt">
[
	{
		id: 'libraries',
		type: 'db-table',
		key: 'libraryid',
		order: 'title',
		// interface: '/batt/examples/libraries.json',
		interface: '/batt/api/feed',
		children: [
			{
				id: 'libraryid',
				type: 'number',
				readOnly: true
			},
			{
				id: 'userid',
				type: 'reference',
				to: 'users.userid'
			},
			{
				id: 'title',
				type: 'string',
				max: 200,
				required: true
			},
			{
				id: 'created',
				type: 'date',
				readOnly: true
			},
			{
				id: 'edited',
				type: 'date',
				readOnly: true
			},
			{
				id: 'status',
				type: 'choice',
				choices: {
					'active': 'Active',
					'deleted': 'Deleted'
				}
			},
		]
	},
	{
		id: 'references',
		type: 'db-table',
		key: 'referenceid',
		order: 'title',
		// interface: '/batt/examples/libraries.json',
		interface: '/batt/api/feed',
		children: [
			{
				id: 'referenceid',
				type: 'number',
				readOnly: true
			},
			{
				id: 'libraryid',
				type: 'reference',
				to: 'libraries.libraryid'
			},
			{
				id: 'title',
				type: 'string',
				max: 200,
				required: true
			},
			{
				id: 'authors',
				type: 'text'
			},
			{
				id: 'created',
				type: 'date',
				readOnly: true
			},
			{
				id: 'edited',
				type: 'date',
				readOnly: true
			},
			{
				id: 'status',
				type: 'choice',
				choices: {
					'active': 'Active',
					'deleted': 'Deleted'
				}
			},
		]
	}
]
</script>
