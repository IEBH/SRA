<?
$title = '404';
require('application/views/site/minimal/header.php');
?>
<div class="pad">
	<div class="hero-unit">
		<h1><?=$heading?></h1>
		<p><?=$message?></p>
		<div style="text-align: center; margin-top: 50px">
			<a class="btn btn-large" href="javascript:window.history.back()"><i class="icon-chevron-left"></i> Go back</a>
			<a class="btn btn-large" href="/"><i class="icon-home"></i> Go to home page</a>
		</div>
	</div>
</div>
<?
require('application/views/site/normal/footer.php');
?>
