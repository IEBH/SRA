<legend>
	<?=$library['title']?>
	<div class="btn-group pull-right">
		<a class="btn dropdown-toggle" data-toggle="dropdown" href="#">
			<i class="icon-cog"></i> Tools <span class="caret"></span>
		</a>
		<ul class="dropdown-menu">
			<li><a href="<?=SITE_ROOT?>libraries/import/<?=$library['libraryid']?>"><i class="icon-cloud-upload"></i> Import references</a></li>
			<li><a href="<?=SITE_ROOT?>libraries/export/<?=$library['libraryid']?>"><i class="icon-cloud-download"></i> Export references</a></li>
			<li class="divider"></li>
			<li><a href="<?=SITE_ROOT?>libraries/dedupe/<?=$library['libraryid']?>"><i class="icon-resize-small"></i> Eliminate Duplicates</a></li>
			<li class="divider"></li>
			<li><a href="<?=SITE_ROOT?>libraries/clear/<?=$library['libraryid']?>" data-confirm="Are you sure? This will delete all references in this library"><i class="icon-trash"></i> Clear all references</a></li>
		</ul>
	</div>
</legend>

<? if (in_array($library['status'], qw('dedupe deduped'))) { ?>
<div class="alert alert-info alert-block">
	<a href="#" data-dismiss="alert" class="close"><i class="icon-remove-sign"></i></a>
	<h3><i class="icon-bell-alt icon-animated-bell"></i> De-duplication in progress</h3>
	<p>This library is still marked as having duplicate references.</p>
	<div class="pull-center pad-top">
		<a class="btn" href="<?=SITE_ROOT?>libraries/dedupe/<?=$library['libraryid']?>"><i class="icon-resize-small"></i> Examine duplicates</a>
		<a class="btn" href="#" data-dismiss="alert"><i class="icon-remove-sign"></i> Not right now</a>
	</div>
</div>
<? } ?>

<script type="batt" src="<?=SITE_ROOT?>batt/schema"></script>
<script type="batt">
[
	{
		type: 'html',
		showIf: {'references-table is': 'empty'},
		text: 
			'<div class="alert alert-info">' +
				'<h3><i class="icon-info-sign"></i> No references in this library</h3>' +
				'<p>This library is empty. You can import references from a file or create new references manually.</p>' +
				'<div class="pull-center"><a href="<?=SITE_ROOT?>libraries/import/<?=$library['libraryid']?>" class="btn"><i class="icon-cloud-upload"></i> Import EndNote XML file</div>' +
			'</div>',
	},
	{
		id: 'references-table',
		uses: 'references',
		type: 'table',
		dataSource: {
			feed: 'references',
			filters: {
				libraryid: '{{#url}}/libraries/view/!{{/url}}',
				status: 'active'
			}
		},
		columns: [
			{
				type: 'dropdown',
				text: '<i class="icon-tag"></i>',
				children: [
					{
						title: '<i class="icon-pencil"></i> Edit',
						action: '<?=SITE_ROOT?>references/edit/{{data._id}}'
					},
					{
						title: '-',
					},
					{
						title: '<i class="icon-trash"></i> Delete',
						action: '<?=SITE_ROOT?>references/delete/{{data._id}}'
					}
				]
			},
			{
				type: 'link',
				title: 'Title',
				text: "{{data.title}}",
				action: '<?=SITE_ROOT?>references/edit/{{data._id}}'
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
						action: '<?=SITE_ROOT?>reference/edit/{{data._id}}'
					}
				]
			}
		]
	}
]
</script>
