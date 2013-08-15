<script>
var libraryid = <?=$library['libraryid']?>;
$(function() {
});
</script>
<div id="dupes-outer"><div id="dupes-inner">
<? foreach ($dupes as $ref) {
	if ($ref['data'])
		$ref = array_merge($ref, json_decode($ref['data'], TRUE));
	$alts = json_decode($ref['altdata'], TRUE);
?>
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
	<table class="table table-bordered table-striped table-hover">
		<thead>
			<th>Field</th>
			<th>Reference A</th>
			<th>Reference B</th>
		</thead>
		<? foreach ($alts as $field => $val) { ?>
		<tr>
			<th><?=$field?></th>
			<td><?=$ref[$field]?></td>
		</tr>
		<? } ?>
	</table>
</div>
<? } ?>
</div></div>
