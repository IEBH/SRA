<legend>
	Manage your libraries
	<div class="btn-group pull-right">
		<a class="btn dropdown-toggle" data-toggle="dropdown" href="#">
			<i class="icon-cog"></i> Tools <span class="caret"></span>
		</a>
		<ul class="dropdown-menu">
			<li><a href="<?=SITE_ROOT?>libraries/import"><i class="icon-cloud-upload"></i> Import references</a></li>
			<li><a href="<?=SITE_ROOT?>libraries/export"><i class="icon-cloud-download"></i> Export references</a></li>
			<li class="divider"></li>
			<li><a href="<?=SITE_ROOT?>libraries/dedupe"><i class="icon-resize-small"></i> Eliminate Duplicates</a></li>
		</ul>
	</div>
</legend>

<script type="batt" src="<?=SITE_ROOT?>batt/schema"></script>
<script type="batt">
[
	{
		uses: 'libraries',
		type: 'table',
		dataSource: {
			feed: 'libraries',
			filters: {
				status: 'active'
			}
		},
		columns: [
			{
				type: 'dropdown',
				columnWidth: '50px',
				children: [
					{
						title: 'View',
						action: '<?=SITE_ROOT?>libraries/view/{{data._id}}'
					},
					{
						title: 'Eliminate duplicates',
						action: '<?=SITE_ROOT?>libraries/dupes/{{data._id}}'
					},
					{
						title: 'Delete',
						action: '<?=SITE_ROOT?>libraries/delete/{{data._id}}'
					},
				]
			},
			{
				type: 'link',
				title: 'Title',
				text: "{{data.title}}",
				action: '<?=SITE_ROOT?>libraries/view/{{data._id}}'
			}
		]
	},
	{
		type: 'button',
		action: '<?=SITE_ROOT?>libraries/create',
		text: '<i class="icon-plus"></i> Create new library',
		class: 'btn btn-success'
	}
]
</script>
