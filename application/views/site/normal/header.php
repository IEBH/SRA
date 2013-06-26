<!DOCTYPE html>
<html lang="en">
<? include('application/views/site/head.php') ?>

<body>
	<div class="navbar" id="navbar">
		<div class="navbar-inner">
			<div class="container-fluid">
				<a class="brand" href="<?=SITE_ROOT?>"><span class="first">CREBP</span> <span class="second">Search</span></a>
				<? if ($references = $this->Basket->GetAll()) { ?>
				<ul class="nav pull-right">
					<li id="fat-menu" class="dropdown">
						<a href="#" id="drop3" role="button" class="dropdown-toggle" data-toggle="dropdown">
							<i class="icon-list"></i> References
						</a>
						<ul class="dropdown-menu">
							<? foreach ($references as $reference) { ?>
							<li><a href="<?=$reference['url']?>"><i class="icon-paper-clip"></i> <?=$reference['title']?></a></li>
							<? } ?>
							<li class="divider"></li>
							<li><a href="/references/clear"><i class="icon-trash"></i> Clear all</a></li>
							<li class="divider"></li>
							<li><a href="/references/export"><i class="icon-share-alt"></i> Export all</a></li>
						</ul>
					</li>
				</ul>
				<? } ?>
			</div>
		</div>
		<div class="pull-right">

		</div>
	</div>
	<? if (!isset($span) || $span) { ?>
	<div class="container-fluid">
		<div class="row-fluid">
			<div class="span12">
			<? include('application/views/site/messages.php') ?>
	<? } ?>
