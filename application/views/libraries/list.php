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
		type: 'html',
		showIf: {'libraries-table is': 'empty'},
		text: 
			'<div class="alert alert-info">' +
				'<h3><i class="icon-info-sign"></i> No libraries found</h3>' +
				'<p>You dont appear to have any reference libraries. You can import an existing EndNote library or create new library manually.</p>' +
				'<div class="pull-center">' +
					'<a href="<?=SITE_ROOT?>libraries/import" class="btn"><i class="icon-cloud-upload"></i> Import EndNote XML file</a>' +
					'&nbsp;' +
					'<a href="<?=SITE_ROOT?>libraries/create" class="btn"><i class="icon-plus"></i> Manually create library</a>' +
				'</div>' +
			'</div>'
	},
	{
		id: 'libraries-table',
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
				text: '<i class="icon-tags"></i>',
				columnWidth: '50px',
				children: [
					{
						title: 'View',
						icon: 'icon-tags',
						action: '<?=SITE_ROOT?>libraries/view/{{data._id}}'
					},
					{
						title: 'Eliminate duplicates',
						icon: 'icon-resize-small',
						action: '<?=SITE_ROOT?>libraries/dupes/{{data._id}}'
					},
					{
						title: 'Delete',
						icon: 'icon-trash',
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
		hideIf: {'libraries-table is': 'empty'},
		action: '<?=SITE_ROOT?>libraries/create',
		text: '<i class="icon-plus"></i> Create new library',
		class: 'btn btn-success'
	}
]
</script>
