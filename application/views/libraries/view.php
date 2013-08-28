<legend>
	Manage your references
	<div class="btn-group pull-right">
		<a class="btn dropdown-toggle" data-toggle="dropdown" href="#">
			<i class="icon-cog"></i> Tools <span class="caret"></span>
		</a>
		<ul class="dropdown-menu">
			<li><a href="<?=SITE_ROOT?>libraries/import/<?=$library['libraryid']?>"><i class="icon-cloud-upload"></i> Import references</a></li>
			<li><a href="<?=SITE_ROOT?>libraries/export/<?=$library['libraryid']?>"><i class="icon-cloud-download"></i> Export references</a></li>
			<li class="divider"></li>
			<li><a href="<?=SITE_ROOT?>libraries/dedupe/<?=$library['libraryid']?>"><i class="icon-resize-small"></i> Eliminate Duplicates</a></li>
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
		uses: 'references',
		type: 'table',
		dataSource: {
			table: 'references',
			filter: {
				libraryid: '{{#url}}/libraries/view/!{{/url}}'
			}
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
