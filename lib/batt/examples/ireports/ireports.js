$(function() {
console.log('LOAD SCHEMA');

$.batt.set([
	{
		id: 'ireports',
		type: 'feed-batt',
		order: 'id',
		url: '/examples/ireports/ireports.example.json',
		children: [
			{
				id: 'id',
				title: 'Report Number',
				display: 'INS-ST-{data.id}',
				type: 'label',
				readOnly: true
			},
			{
				id: 'creator',
				type: 'reference',
				to: 'users.userid'
			},
			{
				id: 'classification',
				type: 'choice',
				choices: {
					'structural': 'Structural',
					'civil': 'Civil',
					'traffic': 'Traffic'
				},
				default: 'structural'
			},
			{
				id: 'stage',
				type: 'choice',
				choices: {
					'pre_pour': 'Pre-Pour',
					'post_pour': 'Post-Pour'
				}
			},
			{
				id: 'description',
				type: 'string',
				max: 30
			},
			{
				id: 'notes',
				type: 'text'
			},
			{
				id: 'sector',
				type: 'string',
				maxLength: 25
			},
			{
				id: 'level',
				type: 'string',
				maxLength: 25
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
]);

});
