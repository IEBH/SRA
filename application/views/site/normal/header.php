<!DOCTYPE html>
<html lang="en">
<? include('application/views/site/head.php') ?>

<body>
	<div class="navbar" id="navbar">
		<div class="navbar-inner">
			<div class="container-fluid">
				<a class="brand" href="<?=SITE_ROOT?>"><span class="first">CREBP</span> <span class="second">Search</span></a>
			</div>
		</div>
	</div>
	<? if (!isset($span) || $span) { ?>
	<div class="container-fluid">
		<div class="row-fluid">
			<div class="span12">
			<? include('application/views/site/messages.php') ?>
	<? } ?>
