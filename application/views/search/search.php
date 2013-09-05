<style>
#searchform {
	margin-top: 20px;
	width: 100%;
}
#searchform .btn-group {
	width: 100%;
}
#searchform h1 {
	font-size: 32px;
	margin: 20px;
}
#searchform .btn {
	height: 55px;
	font-size: 25px;
	padding: 0 10px;
	vertical-align: top;
}
#q {
	width: 70%;
	font-size: 25px;
	height: 45px;
}
</style>
<form action="<?=SITE_ROOT?>search" method="GET" class="row">
	<div id="searchform" class="pull-center">
		<? if ($papers === null) { ?>
		<h1 class="pad-top">Search for research papers</h1>
		<? } ?>
		<div class="btn-group">
			<input data-focus="1" id="q" name="q" type="search" value="<?=$_REQUEST['q']?>"/>
			<button class="btn" type="submit"><i class="icon-search"></i></button>
		</div>
	</div>
</form>
<?
if ($papers) {
	$basket = $this->Library->GetBasket();
?>
<table class="table table-bordered table-stripped">
	<tr>
		<th width="50px">&nbsp;</th>
		<th>Ref</th>
		<th>Name</th>
	</tr>
	<? foreach ($papers as $paper) { ?>
	<tr>
		<? if ($this->Library->Has('who-' . $paper['paperid'], $basket['libraryid'])) { ?>
		<td><a href="<?=SITE_ROOT?>who/remove/<?=$paper['paperid']?>" class="btn btn-success"><i class="icon-check"></i></td>
		<? } else { ?>
		<td><a href="<?=SITE_ROOT?>who/add/<?=$paper['paperid']?>" class="btn"><i class="icon-check-empty"></i></td>
		<? } ?>
		<td><a href="<?=$paper['url']?>"><?=$paper['paperid']?></a></td>
		<td><a href="<?=$paper['url']?>"><?=$paper['name']?></a></td>
	</tr>
	<? } ?>
</table>
<? } elseif ($papers !== null) { ?>
<div class="alert">
	<h3>No results found</h3>
	<p>No results were found from this search. Maybe try removing some of your search criteria.</p>
</div>
<? } ?>
