<script>
$(function() {
	$('#reference-table')
		.on('click', 'a[data-action=set-tag]', function() {
			var me = $(this);
			var tr = $(this).closest('tr')
				.attr('rel', $(this).data('action-tag'));
			me.closest('.btn-group').find('.btn').removeClass('btn-primary btn-danger').addClass('btn-default');
			me.removeClass('btn-default').addClass(me.data('action-tag') == 0 ? 'btn-danger' : 'btn-primary');

			$.ajax({
				url: '/api/libraries/settag',
				data: {
					referenceid: tr.data('id'),
					tagid: $(this).data('action-tag')
				},
				type: 'POST',
				dataType: 'json',
				success: function(json) {
					if (json.header.status == 'ok') {
						$.each(json.tags, function(i, count) {
							var a = $('#tag-filter a[data-filterid="' + i + '"]');
							if (!count || count == 0) {
								a.children('span.badge').remove();
							} else if (a.children('span.badge').length == 0) {
								a.append(' <span class="badge badge-info">' + count + '</span>');
							} else
								a.children('span.badge').text(count);
						});
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

	$('#tag-filter').on('click', 'a[data-filterid]', function() {
		$('#tag-filter > li').removeClass('active');
		$(this).closest('li').addClass('active');

		if (!$(this).data('filterid')) {
			$('#reference-table > tbody > tr').show();
		} else {
			$('#reference-table > tbody > tr').hide();
			$('#reference-table > tbody > tr[rel="' + $(this).data('filterid') + '"]').show();
		}
	});

	// Deal with preview mode
	if ($('.page-screening').has('.enable-preview')) {
		$('.page-content').css('padding', 0);
		$(window)
			.on('resize', function() {
				$('.page-screening').css('height', $(window).height() - 108);
			})
			.trigger('resize');
	}
});
</script>
<div class="page-screening enable-preview">
	<div class="screen-list">
		<legend>
			<?=$library['title']?>
			<div class="btn-group pull-right">
				<a class="btn dropdown-toggle" data-toggle="dropdown" href="#">
					<i class="icon-cog"></i> Tools <span class="caret"></span>
				</a>
				<ul class="dropdown-menu">
					<? $this->load->view('libraries/verbs', array('library' => $library)) ?>
				</ul>
			</div>
		</legend>

		<? if (!$references) { ?>
		<div class="alert alert-info">
			<h3><i class="icon-info-sign"></i> No references in this library</h3>
			<p>This library is empty. You can import references from a file or create new references manually.</p>
			<div class="pull-center">
				<a href="/libraries/import/<?=$library['libraryid']?>" class="btn"><i class="icon-cloud-upload"></i> Import library file</a>
			</div>
		</div>
		<? } else { ?>
		<? if ($tags) { ?>
		<ul class="nav nav-tabs" id="tag-filter">
			<li class="active"><a href="#" data-filterid="0"><i class="icon-asterisk"></i> All <span class="badge badge-info"><?=$this->Reference->Count(array('libraryid' => $library['libraryid'], 'status !=' => 'deleted'))?></span></a></li>
			<? foreach ($tags as $tag) { ?>
			<li>
				<a href="#" data-filterid="<?=$tag['referencetagid']?>"><?=$tag['title']?>
				<? if ($count = $this->Reference->Count(array('libraryid' => $library['libraryid'], 'status !=' => 'deleted', 'referencetagid' => $tag['referencetagid']))) { ?>
					<span class="badge badge-info"><?=$count?></span>
				<? } ?>
				</a>
			</li>
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
			<tr data-id="<?=$reference['referenceid']?>" rel="<?=$reference['referencetagid']?>">
				<td>
					<div class="dropdown">
						<a class="btn" data-toggle="dropdown"><i class="icon-tag"></i></a>
						<ul class="dropdown-menu">
							<li><a href="/references/edit/<?=$reference['referenceid']?>"><i class="icon-pencil"></i> Edit</a></li>
							<li class="divider"></li>
							<li><a href="/references/delete/<?=$reference['referenceid']?>"><i class="icon-trash"></i> Delete</a></li>
						</ul>
					</div>
				</td>
				<td><a href="/references/edit/<?=$reference['referenceid']?>"><?=$reference['title']?></a></td>
				<td>
					<a href="/references/edit/<?=$reference['referenceid']?>">
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
						<a class="btn btn-small <?=!$reference['referencetagid']?'btn-danger':'btn-default'?>" data-action="set-tag" data-action-tag="0">Unfiled</a>
						<? foreach ($tags as $tag) { ?>
						<a class="btn btn-small <?=$reference['referencetagid']==$tag['referencetagid']?'btn-primary':'btn-default'?>" data-action="set-tag" data-action-tag="<?=$tag['referencetagid']?>"><?=$tag['title']?></a>
						<? } ?>
					</div>
				</td>	
			</tr>
			<? } ?>
		</table>
		
		<div class="pull-center">
			<?=$this->pagination->create_links()?>
		</div>
	</div>
	<div class="screen-preview">
		<div class="btn-group">
			<? foreach ($tags as $tag) { ?>
			<a class="btn btn-small"><?=$tag['title']?></a>
			<? } ?>
		</div>
	</div>
</div>
<? } ?>
