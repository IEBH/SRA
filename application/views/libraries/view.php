<legend>
	Manage your references
	<div class="btn-group pull-right">
		<a class="btn dropdown-toggle" data-toggle="dropdown" href="#">
			<i class="icon-cog"></i> Tools <span class="caret"></span>
		</a>
		<ul class="dropdown-menu">
			<li><a href="/libraries/import/<?=$library['libraryid']?>"><i class="icon-cloud-upload"></i> Import references</a></li>
			<li><a href="/libraries/export/<?=$library['libraryid']?>"><i class="icon-cloud-download"></i> Export references</a></li>
			<li class="divider"></li>
			<li><a href="/libraries/dedupe/<?=$library['libraryid']?>"><i class="icon-resize-small"></i> Eliminate Duplicates</a></li>
		</ul>
	</div>
</legend>

<script type="batt" src="/batt/schema"></script>
<script type="batt">
[
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
						title: '<i class="icon-pencil"></i> Edit',
						action: '/reference/edit/{{data._id}}'
					},
					{
						title: '-',
					},
					{
						title: '<i class="icon-trash"></i> Delete',
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
