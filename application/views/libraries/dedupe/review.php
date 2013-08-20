<script>
var libraryid = <?=$library['libraryid']?>;
$(function() {
	$(document)
		.on('click', '.duplicate table td.selectable', function() {
			$(this).closest('tr').find('td').removeClass('selected');
			$(this).addClass('selected');
		})
		.on('click', '.duplicate [data-action=dupe-save]', function(event) {
			event.preventDefault();
			var refid = $(this).closest('.duplicate').data('referenceid');
		})
		.on('click', '.duplicate [data-action=dupe-delete]', function(event) {
			event.preventDefault();
			var refid = $(this).closest('.duplicate').data('referenceid');
			var refid2 = $(this).closest('.duplicate').data('referenceid2');
		});
});
</script>
<style>
.duplicate table {
	width: 100%;
}
.duplicate table td.selectable {
	padding: 10px;
	word-break: break-all;
}
.duplicate table td.selected {
	color: #468847 !important;
	background: #dff0d8 !important;
}
</style>
<legend>
	De-duplication review
	<div class="btn-group pull-right">
		<a class="btn dropdown-toggle" data-toggle="dropdown" href="#">
			<i class="icon-cog"></i> <span class="caret"></span>
		</a>
		<ul class="dropdown-menu">
			<li><a href="/libraries/dedupe/<?=$library['libraryid']?>/force"><i class="icon-resize-small"></i> Force reprocessing</a></li>
		</ul>
	</div>
</legend>

<div id="dupes-outer" data-url="/libraries/dedupe/<?=$library['libraryid']?>"><div id="dupes-inner">

<div class="infobox-container">
	<div class="infobox infobox-green infobox-small infobox-dark">
		<div class="infobox-icon">
			<i class="icon-tag"></i>
		</div>

		<div class="infobox-data">
			<div class="infobox-content">References</div>
			<div class="infobox-content"><?=$this->Format->Number($this->Reference->Count(array('libraryid' => $library['libraryid'])))?></div>
		</div>
	</div>

	<div class="infobox infobox-blue infobox-small infobox-dark">
		<div class="infobox-icon">
			<i class="icon-resize-small"></i>
		</div>

		<div class="infobox-data">
			<div class="infobox-content">Duplicates</div>
			<div class="infobox-content"><?=$this->Format->Number($this->Reference->Count(array('libraryid' => $library['libraryid'], 'status' => 'dupe')))?></div>
		</div>
	</div>

	<div class="infobox infobox-grey infobox-small infobox-dark">
		<div class="infobox-icon">
			<i class="icon-trash"></i>
		</div>

		<div class="infobox-data">
			<div class="infobox-content">Deleted</div>
			<div class="infobox-content"><?=$this->Format->Number($this->Reference->Count(array('libraryid' => $library['libraryid'], 'status' => 'deleted')))?></div>
		</div>
	</div>
</div>

<hr/>

<? foreach ($dupes as $ref) {
	if ($ref['data'])
		$ref = array_merge($ref, json_decode($ref['data'], TRUE));
	$alts = json_decode($ref['altdata'], TRUE);

	$altrefs = array();
	foreach($alts as $key => $vals) 
		foreach ($vals as $refid => $data)
			$altrefs[$refid] = 1;
?>
<div class="duplicate" data-referenceid="<?=$ref['referenceid']?>" data-referenceid2="<?=implode(',', array_keys($altrefs))?>">
	<legend>
		<?=$ref['title']?>
		<div class="btn-group pull-right">
			<a class="btn dropdown-toggle" data-toggle="dropdown" href="#">
				<i class="icon-tag"></i> <span class="caret"></span>
			</a>
			<ul class="dropdown-menu">
				<li><a href="/references/edit/<?=$ref['referenceid']?>"><i class="icon-pencil"></i> Edit reference </a></li>
				<li class="divider"></li>
				<li><a href="/references/delete/<?=$ref['referenceid']?>"><i class="icon-trash"></i> Delete reference</a></li>
			</ul>
		</div>
	</legend>
	<div class="row-fluid pad-top">
		<table class="table table-bordered table-striped table-hover table-dupes">
			<thead>
				<th>Field</th>
				<th><a href="/references/view/<?=$ref['referenceid']?>">Reference #<?=$ref['referenceid']?></a></th>
				<? foreach ($altrefs as $altrefid => $junk) { ?>
				<th><a href="/references/view/<?=$altrefid?>">Reference #<?=$altrefid?></a></th>
				<? } ?>
			</thead>
			<? foreach ($alts as $field => $val) { ?>
			<tr>
				<th><?=$field?></th>
				<td class="selectable selected"><div><?=$this->Reference->Flatten($ref[$field], "<br/>")?></div></td>
				<? foreach ($altrefs as $altrefid => $junk) { ?>
				<? if (isset($alts[$field][$altrefid])) { ?>
					<td class="selectable"><div><?=$this->Reference->Flatten($alts[$field][$altrefid])?></div></td>
				<? } else { ?>
					<td>&nbsp;</td>
				<? } ?>
				<? } ?>
			</tr>
			<? } ?>
		</table>
		<div class="pull-center pad-bottom">
			<div class="btn-group">
				<a class="btn" href="#" data-action="dupe-save"><i class="icon-ok"></i> Save</a>
				<a class="btn dropdown-toggle" data-toggle="dropdown"><span class="caret"></span></a>
				<ul class="dropdown-menu pull-reset">
					<li><a href="#" data-action="dupe-save"><i class="icon-ok"></i> Save</a></li>
					<li><a href="#" data-action="dupe-break"><i class="icon-remove"></i> Mark as non-duplicates</a></li>
					<li><a href="#" data-action="dupe-delete"><i class="icon-trash"></i> Delete both references</a></li>
				</ul>
			</div>
		</div>
	</div>
	<? } ?>
</div>
</div></div>
