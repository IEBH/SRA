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

<? if (!$libraries) { ?>
<div class="alert alert-info">
	<div class="alert alert-info">
		<h3><i class="icon-info-sign"></i> No libraries found</h3>
		<p>You dont appear to have any reference libraries. You can import an existing EndNote library or create new library manually.</p>
		<div class="pull-center">
			<a href="<?=SITE_ROOT?>libraries/import" class="btn"><i class="icon-cloud-upload"></i> Import EndNote XML file</a>
			&nbsp;
			<a href="<?=SITE_ROOT?>libraries/create" class="btn"><i class="icon-plus"></i> Manually create library</a>
		</div>
	</div>
</div>
<? } else { ?>
<table class="table table-striped table-bordered">
	<tr>
		<th width="60px">&nbsp;</th>
		<th>Title</th>
		<th width="100px">References</th>
	</tr>
	<? foreach ($libraries as $library) { ?>
	<tr>
		<td>
			<div class="dropdown">
				<a class="btn" data-toggle="dropdown"><i class="icon-tags"></i></a>
				<ul class="dropdown-menu">
					<li><a href="<?=SITE_ROOT?>libraries/view/<?=$library['libraryid']?>"><i class="icon-tags"></i> View</a></li>
					<li><a href="<?=SITE_ROOT?>libraries/dupes/<?=$library['libraryid']?>"><i class="icon-resize-small"></i> Eliminate duplicates</a></li>
					<li class="divider"></li>
					<li><a href="<?=SITE_ROOT?>libraries/delete/<?=$library['libraryid']?>"><i class="icon-trash"></i> Delete</a></li>
				</ul>
			</div>
		</td>
		<td><a href="<?=SITE_ROOT?>libraries/view/<?=$library['libraryid']?>"><?=$library['title']?></a></td>
		<td><a href="<?=SITE_ROOT?>libraries/view/<?=$library['libraryid']?>"><span class="badge badge-info"><i class="icon-tag"></i> <?=$this->Reference->Count(array('libraryid' => $library['libraryid'], 'status !=' => 'deleted'))?></span></a></td>
	</tr>
	<? } ?>
</table>
<? } ?>
