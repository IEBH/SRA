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
			var dupe = $(this).closest('.duplicate');
			$.actionDupe({action: 'save', left: dupe.data('referenceid'), right: dupe.data('referenceid2')});
			dupe.slideUp('slow', function() {
				dupe.remove();
			});
		})
		.on('click', '.duplicate [data-action=dupe-delete]', function(event) {
			event.preventDefault();
			var dupe = $(this).closest('.duplicate');
			$.actionDupe({action: 'delete', left: dupe.data('referenceid'), right: dupe.data('referenceid2')});
			dupe.slideUp('slow', function() {
				dupe.remove();
			});
		})
		.on('click', '.duplicate [data-action=dupe-break]', function(event) {
			event.preventDefault();
			var dupe = $(this).closest('.duplicate');
			$.actionDupe({action: 'break', left: dupe.data('referenceid'), right: dupe.data('referenceid2')});
			dupe.slideUp('slow', function() {
				dupe.remove();
			});
		});

	/**
	* Send a command to the de-duplicator
	* @param hash data The hash to send via POST
	* @param bool refresh Whether to redraw the form on success
	*/
	$.actionDupe = function(data, refresh) {
		$.ajax({
			url: '/api/libraries/dupeaction',
			data: data,
			type: 'POST',
			dataType: 'json',
			success: function(json) {
				if (json.header.status == 'ok') {
					if (refresh)
						$('#dupes-outer').load($('#dupes-outer').data('url') + ' #dupes-inner');
				} else if (json.header.error) {
					alert(json.header.error);
				} else
					alert('An unknown error occured');
			},
			error: function(e, err) {
				alert('An error occured: ' + err);
			}
		});
	};
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
			<i class="icon-cog"></i> Tools <span class="caret"></span>
		</a>
		<ul class="dropdown-menu">
			<li><a href="/libraries/view/<?=$library['libraryid']?>"><i class="icon-arrow-left"></i> Return to library</a></li>
			<li class="divider"></li>
			<li><a href="/libraries/export/<?=$library['libraryid']?>"><i class="icon-cloud-download"></i> Export references</a></li>
			<li class="divider"></li>
			<li><a href="/libraries/share/<?=$library['libraryid']?>"><i class="icon-share-alt"></i> Share library</a></li>
			<li class="divider"></li>
			<li><a href="/libraries/dedupe/<?=$library['libraryid']?>/force"><i class="icon-resize-small"></i> Force reprocessing</a></li>
			<li><a href="/libraries/finish/<?=$library['libraryid']?>/force"><i class="icon-remove"></i> Cancel de-duplication</a></li>
		</ul>
	</div>
</legend>

<div id="dupes-outer" data-url="/libraries/dedupe/<?=$library['libraryid']?>"><div id="dupes-inner">

<div class="infobox-container">
	<div class="infobox infobox-green infobox-medium infobox-dark">
		<div class="infobox-icon">
			<i class="icon-tag"></i>
		</div>

		<div class="infobox-data">
			<div class="infobox-content">References</div>
			<div class="infobox-content"><?=$this->Format->Number($this->Reference->Count(array('libraryid' => $library['libraryid'])))?></div>
		</div>
	</div>

	<div class="infobox infobox-blue infobox-medium infobox-dark">
		<div class="infobox-icon">
			<i class="icon-resize-small"></i>
		</div>

		<div class="infobox-data">
			<div class="infobox-content">Duplicates</div>
			<div class="infobox-content"><?=$markeddupes = $this->Format->Number($this->Reference->Count(array('libraryid' => $library['libraryid'], 'status' => 'dupe')))?></div>
		</div>
	</div>

	<div class="infobox infobox-grey infobox-medium infobox-dark">
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

<div class="alert alert-info">
	<h3><i class="icon-tags"></i> Review duplicates</h3>
	<p>The deduplicator has resolved as many possible duplicates as it can.</p>
	<p>However, the below duplicates have different posibile fields to choose from. This can often occur where two papers are detected as duplicates but this software doesn't know which set of data to use.</p>
	<p>You can highlight the data you want to use below and press save or just skip this process to use the most likely entry.</p>
	<div class="pull-center">
		<a href="/libraries/finish/<?=$library['libraryid']?>" class="btn" data-tip="End the de-duplicate review stage and accept all recommendations" data-tip-placement="bottom"><i class="icon-remove-sign"></i> Skip review stage</a>
		<a href="/libraries/view/<?=$library['libraryid']?>" class="btn" data-tip="Retain all the unmerged data below and continue this process at a later date" data-tip-placement="bottom"><i class="icon-forward"></i> Come back to this later</a>
	</div>
</div>

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
		<?
		if (count($altrefs) == 1) {
			$width = '50%';
		} elseif (count($altrefs) == 2) {
			$width = '33%';
		} else
			$width = 'auto';
		?>
		<table class="table table-bordered table-striped table-hover table-dupes">
			<thead>
				<th>Field</th>
				<th width="<?=$width?>"><a href="/references/view/<?=$ref['referenceid']?>">Reference #<?=$ref['referenceid']?></a></th>
				<? foreach ($altrefs as $altrefid => $junk) { ?>
				<th width="<?=$width?>"><a href="/references/view/<?=$altrefid?>">Reference #<?=$altrefid?></a></th>
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
				<a class="btn btn-default" href="#" data-action="dupe-break"><i class="icon-resize-full"></i> Not duplicates</a>
				<a class="btn btn-success" href="#" data-action="dupe-save"><i class="icon-resize-small"></i> Merge</a>
				<a class="btn btn-default" href="#" data-action="dupe-delete"><i class="icon-trash"></i> Delete both</a>
			</div>
		</div>
	</div>
</div>
<? } ?>
</div></div>
<div class="alert alert-info">
	<h3><i class="icon-smile"></i> End of duplicate list</h3>
	<p>There are now more duplicates to review.</p>
	<div class="pull-center">
		<a href="/libraries/finish/<?=$library['libraryid']?>" class="btn"><i class="icon-tags"></i> View <?=$library['title']?></a>
	</div>
</div>
