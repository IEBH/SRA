<script type="batt">
[
	{
		id: 'libraries',
		type: 'feed-batt',
		url: '<?=SITE_ROOT?>batt/api/feed',
		key: 'libraryid',
		order: 'title',

		joins: {
			'user2library': 'user2library.libraryid = libraries.libraryid'
		},
		filters: {
			'user2library.userid': '<?=$this->User->GetActive('userid')?>'
		},

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
		type: 'feed-batt',
		url: '<?=SITE_ROOT?>batt/api/feed',
		key: 'referenceid',
		order: 'title',
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
