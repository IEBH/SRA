<script type="batt" src="<?=SITE_ROOT?>batt/schema"></script>
<script type="batt">
[
	{
		type: 'container',
		uses: 'references',
		children: [
			{
				type: 'heading',
				title: '{{data.title}}'
			},
			{id: 'title'},
			{id: 'authors'}
		]
	}
]
</script>
