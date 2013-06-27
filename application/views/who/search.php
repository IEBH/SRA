<? if (!$papers) { ?>
<div class="alert">
	<h3>No results found</h3>
	<p>No results were found from this search. Maybe try removing some of your search criteria.</p>
</div>
<? } else { ?>
<table class="table table-bordered table-stripped">
	<tr>
		<th width="50px">&nbsp;</th>
		<th>Ref</th>
		<th>Name</th>
	</tr>
	<? foreach ($papers as $paper) { ?>
	<tr>
		<? if ($this->Basket->Has('who-' . $paper['paperid'])) { ?>
		<td><a href="<?=SITE_ROOT?>who/remove/<?=$paper['paperid']?>" class="btn btn-success"><i class="icon-check"></i></td>
		<? } else { ?>
		<td><a href="<?=SITE_ROOT?>who/add/<?=$paper['paperid']?>" class="btn"><i class="icon-check-empty"></i></td>
		<? } ?>
		<td><a href="<?=$paper['url']?>"><?=$paper['paperid']?></a></td>
		<td><a href="<?=$paper['url']?>"><?=$paper['name']?></a></td>
	</tr>
	<? } ?>
</table>
<? } ?>
