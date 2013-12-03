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
<table class="table table-striped table-bordered">
	<tr>
		<th width="60px">&nbsp;</th>
		<th>Title</th>
		<th>Authors</th>
	</tr>
	<? foreach ($references as $reference) { ?>
	<tr>
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
				if ($authorno++ > 3) { ?>
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
