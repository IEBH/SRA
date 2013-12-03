<script>
$(function() {
	$('#reference-table')
		.on('click', 'a[data-action=set-tag]', function() {
			var tr = $(this).closest('tr')
				.attr('rel', $(this).data('action-tag'));
			$(this).closest('.btn-group').find('.btn').removeClass('btn-primary');
			$(this).addClass('btn-primary');
			$('#tab-filter a[data-filterid]').each(function() {
				var count = $('#reference-table tr[rel="' + $(this).data('filterid') + '"]').length;
				if (!count) {
					$(this).children('span.badge').remove();
				} else if ($(this).children('span.badge').length == 0) {
					$(this).append(' <span class="badge badge-info">' + count + '</span>');
				} else
					$(this).children('span.badge').text(count);
			});

			$.ajax({
				url: '<?=SITE_ROOT?>api/libraries/settag',
				data: {
					referenceid: tr.data('id'),
					tagid: $(this).data('action-tag')
				},
				type: 'POST',
				dataType: 'json',
				success: function(json) {
					if (json.header.status == 'ok') {
						// Pass
					} else if (json.header.error) {
						alert(json.header.error);
					} else
						alert('An unknown error occured');
				},
				error: function(e, err) {
					alert('An error occured: ' + err);
				}
			});
		});

	$('#tab-filter').on('click', 'a[data-filterid]', function() {
		$('#tab-filter > li').removeClass('active');
		$(this).closest('li').addClass('active');

		if (!$(this).data('filterid')) {
			$('#reference-table > tbody > tr').show();
		} else {
			$('#reference-table > tbody > tr').hide();
			$('#reference-table > tbody > tr[rel="' + $(this).data('filterid') + '"]').show();
		}
	});
});
</script>
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
			<li><a href="<?=SITE_ROOT?>libraries/share/<?=$library['libraryid']?>"><i class="icon-share-alt"></i> Share library</a></li>
			<li class="divider"></li>
			<li><a href="<?=SITE_ROOT?>libraries/dedupe/<?=$library['libraryid']?>"><i class="icon-resize-small"></i> Eliminate Duplicates</a></li>
			<li class="divider"></li>
			<li><a href="<?=SITE_ROOT?>libraries/clear/<?=$library['libraryid']?>" data-confirm="Are you sure? This will delete all references in this library"><i class="icon-trash"></i> Clear all references</a></li>
		</ul>
	</div>
</legend>

<? if (!$references) { ?>
<div class="alert alert-info">
	<h3><i class="icon-info-sign"></i> No references in this library</h3>
	<p>This library is empty. You can import references from a file or create new references manually.</p>
	<div class="pull-center">
		<a href="<?=SITE_ROOT?>libraries/import/<?=$library['libraryid']?>" class="btn"><i class="icon-cloud-upload"></i> Import EndNote XML file</a>
	</div>
</div>
<? } else { ?>
<? if ($tags) { ?>
<ul class="nav nav-tabs" id="tab-filter">
	<li class="active"><a href="#" data-filterid="0"><i class="icon-asterisk"></i> All <span class="badge badge-info"><?=count($references)?></span></a></li>
	<? foreach ($tags as $tag) { ?>
	<li><a href="#" data-filterid="<?=$tag['referencetagid']?>"><?=$tag['title']?></a></li>
	<? } ?>
</ul>
<? } ?>
<table class="table table-striped table-bordered" id="reference-table">
	<tr>
		<th width="60px">&nbsp;</th>
		<th>Title</th>
		<th>Authors</th>
	</tr>
	<? foreach ($references as $reference) { ?>
	<tr data-id="<?=$reference['referenceid']?>">
		<td>
			<div class="dropdown">
				<a class="btn" data-toggle="dropdown"><i class="icon-tag"></i></a>
				<ul class="dropdown-menu">
					<li><a href="<?=SITE_ROOT?>references/edit/<?=$reference['referenceid']?>"><i class="icon-pencil"></i> Edit</a></li>
					<li class="divider"></li>
					<li><a href="<?=SITE_ROOT?>references/delete/<?=$reference['referenceid']?>"><i class="icon-trash"></i> Delete</a></li>
				</ul>
			</div>
		</td>
		<td><a href="<?=SITE_ROOT?>references/edit/<?=$reference['referenceid']?>"><?=$reference['title']?></a></td>
		<td>
			<a href="<?=SITE_ROOT?>references/edit/<?=$reference['referenceid']?>">
			<?
			$authorno = 0;
			$authors = explode(' AND ', $reference['authors']);
			foreach ($authors as $author) {
				if ($authorno++ > 2) { ?>
					<span class="badge"><i class="icon-group"></i> + <?=count($authors) + 1 - $authorno?> more</span>
				<?
					break;
				} ?>
				<span class="badge badge-info"><i class="icon-user"></i> <?=$author?></span>
			<? } ?>
			</a>
		</td>
		<td>
			<div class="btn-group">
				<a class="btn btn-small <?=!$reference['referencetagid']?'btn-primary':''?>" data-action="set-tag" data-action-tag="0">Unfiled</a>
				<? foreach ($tags as $tag) { ?>
				<a class="btn btn-small <?=$reference['referencetagid']==$tag['referencetagid']?'btn-primary':''?>" data-action="set-tag" data-action-tag="<?=$tag['referencetagid']?>"><?=$tag['title']?></a>
				<? } ?>
			</div>
		</td>	
	</tr>
	<? } ?>
</table>
<div class="pull-center">
	<?=$this->pagination->create_links()?>
</div>
<? } ?>
