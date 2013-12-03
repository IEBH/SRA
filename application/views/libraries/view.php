<script>
$(function() {
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
});
</script>
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
<ul class="nav nav-tabs" id="tag-filter">
	<li class="active"><a href="#" data-filterid="0"><i class="icon-asterisk"></i> All</a></li>
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
	<tr rel="<?=$reference['referencetagid']?>">
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
	</tr>
	<? } ?>
</table>
<? } ?>
