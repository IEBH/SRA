<!DOCTYPE HTML>
<html lang="en">
<? include('application/views/site/head.php') ?>

<body class="navbar-fixed">
<div class="navbar navbar-fixed-top">
	<div class="navbar-inner">
		<div class="container-fluid">
			<a href="<?=SITE_ROOT?>" class="brand">
				<small><i class="icon-leaf"></i> <?=SITE_TITLE?></small>
			</a><!--/.brand-->

			<ul class="nav ace-nav pull-right">
				<li class="light-blue">
					<? if (isset($this->User) && $this->User->GetActive()) { ?>
					<a data-toggle="dropdown" href="#" class="dropdown-toggle">
						<span class="user-info">
							<small>Welcome,</small> <?=$this->User->GetName(NULL, TRUE)?>
						</span>
						<i class="icon-caret-down"></i>
					</a>
					<ul class="user-menu pull-right dropdown-menu dropdown-yellow dropdown-caret dropdown-closer">
						<li><a href="<?=SITE_ROOT?>logout"><i class="icon-off"></i> Logout</a></li>
					</ul>
					<? } else { ?>
					<a href="<?=SITE_ROOT?>login"><i class="icon-user"></i> Login</a>
					<? } ?>
				</li>
			</ul><!--/.ace-nav-->
		</div><!--/.container-fluid-->
	</div><!--/.navbar-inner-->
</div>

<div class="main-container container-fluid">
	<a class="menu-toggler" id="menu-toggler" href="#">
		<span class="menu-text"></span>
	</a>

	<div class="sidebar fixed" id="sidebar">
		<div class="sidebar-shortcuts" id="sidebar-shortcuts">
			<div class="sidebar-shortcuts-large" id="sidebar-shortcuts-large">
				<a href="<?=SITE_ROOT?>how-to" class="btn btn-small btn-success" data-tip-placement="right" data-tip="How to create a systematic review">
					<i class="icon-book"></i>
				</a>

				<a href="<?=SITE_ROOT?>libraries" class="btn btn-small btn-info" data-tip-placement="right" data-tip="View your reference libraries">
					<i class="icon-tags"></i>
				</a>

				<a class="btn btn-small btn-warning">
					<i class="icon-group"></i>
				</a>

				<a href="<?=SITE_ROOT?>search" class="btn btn-small btn-danger" data-tip-placement="right" data-tip="Search for research papers">
					<i class="icon-search"></i>
				</a>
			</div>

			<div class="sidebar-shortcuts-mini" id="sidebar-shortcuts-mini">
				<span class="btn btn-success"></span>

				<span class="btn btn-info"></span>

				<span class="btn btn-warning"></span>

				<span class="btn btn-danger"></span>
			</div>
		</div><!--#sidebar-shortcuts-->

		<? include('application/views/site/sidebar.php') ?>

		<div class="main-content">
			<div class="breadcrumbs" id="breadcrumbs">
				<ul class="breadcrumb">
					<li>
						<i class="icon-home home-icon"></i>
						<a href="<?=SITE_ROOT?>">Home</a>
						<span class="divider"><i class="icon-angle-right arrow-icon"></i></span>
					</li>
					<? if (isset($breadcrumbs) && $breadcrumbs) { ?>
					<? foreach ($breadcrumbs as $link => $crumb) { ?>
					<a href="<?=$link?>"><?=$crumb?></a>
					<span class="divider"><i class="icon-angle-right arrow-icon"></i></span>
					<? } ?>
					<? } ?>
					<li><?=$title?></li>
				</ul><!--.breadcrumb-->

				<div class="nav-search" id="nav-search">
					<form class="form-search">
						<span class="input-icon">
							<input type="text" placeholder="Search ..." class="input-small nav-search-input" id="nav-search-input" autocomplete="off" />
							<i class="icon-search nav-search-icon"></i>
						</span>
					</form>
				</div><!--#nav-search-->
			</div>

			<div class="page-content">
				<div class="page-header position-relative">
