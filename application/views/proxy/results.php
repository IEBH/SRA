<? if (!$papers) { ?>
<div class="alert">
	<h3>No results found</h3>
	<p>No results were found from this search. Maybe try removing some of your search criteria.</p>
</div>
<? } else { ?>
<table class="table table-bordered table-stripped">
	<tr>
		<th>Ref</th>
		<th>Name</th>
		<th width="50px">&nbsp;</th>
	</tr>
	<? foreach ($papers as $paperid => $paper) { ?>
	<tr>
		<td><?=$paperid?></td>
		<td><?=$paper?></td>
		<td><a href="#" class="btn"><i class="icon-empty"></i></td>
	</tr>
	<? } ?>
</table>
<? } ?>
