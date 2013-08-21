<!DOCTYPE HTML>
<html lang="en">
<? include('application/views/site/head.php') ?>

<body class="navbar-fixed">
<div class="navbar navbar-fixed-top">
	<div class="navbar-inner">
		<div class="container-fluid">
			<a href="/" class="brand">
				<small><i class="icon-leaf"></i> <?=SITE_TITLE?></small>
			</a><!--/.brand-->

			<ul class="nav ace-nav pull-right">
				<li class="grey">
					<a data-toggle="dropdown" class="dropdown-toggle" href="#">
						<i class="icon-tasks"></i>
						<span class="badge badge-grey">4</span>
					</a>

					<ul class="pull-right dropdown-navbar dropdown-menu dropdown-caret dropdown-closer">
						<li class="nav-header">
							<i class="icon-ok"></i>
							4 Tasks to complete
						</li>

						<li>
							<a href="#">
								<div class="clearfix">
									<span class="pull-left">Software Update</span>
									<span class="pull-right">65%</span>
								</div>

								<div class="progress progress-mini ">
									<div style="width:65%" class="bar"></div>
								</div>
							</a>
						</li>

						<li>
							<a href="#">
								<div class="clearfix">
									<span class="pull-left">Hardware Upgrade</span>
									<span class="pull-right">35%</span>
								</div>

								<div class="progress progress-mini progress-danger">
									<div style="width:35%" class="bar"></div>
								</div>
							</a>
						</li>

						<li>
							<a href="#">
								<div class="clearfix">
									<span class="pull-left">Unit Testing</span>
									<span class="pull-right">15%</span>
								</div>

								<div class="progress progress-mini progress-warning">
									<div style="width:15%" class="bar"></div>
								</div>
							</a>
						</li>

						<li>
							<a href="#">
								<div class="clearfix">
									<span class="pull-left">Bug Fixes</span>
									<span class="pull-right">90%</span>
								</div>

								<div class="progress progress-mini progress-success progress-striped active">
									<div style="width:90%" class="bar"></div>
								</div>
							</a>
						</li>

						<li>
							<a href="#">
								See tasks with details
								<i class="icon-arrow-right"></i>
							</a>
						</li>
					</ul>
				</li>

				<li class="purple">
					<a data-toggle="dropdown" class="dropdown-toggle" href="#">
						<i class="icon-bell-alt icon-animated-bell"></i>
						<span class="badge badge-important">8</span>
					</a>

					<ul class="pull-right dropdown-navbar navbar-pink dropdown-menu dropdown-caret dropdown-closer">
						<li class="nav-header">
							<i class="icon-warning-sign"></i>
							8 Notifications
						</li>

						<li>
							<a href="#">
								<div class="clearfix">
									<span class="pull-left">
										<i class="btn btn-mini no-hover btn-pink icon-comment"></i>
										New Comments
									</span>
									<span class="pull-right badge badge-info">+12</span>
								</div>
							</a>
						</li>

						<li>
							<a href="#">
								<i class="btn btn-mini btn-primary icon-user"></i>
								Bob just signed up as an editor ...
							</a>
						</li>

						<li>
							<a href="#">
								<div class="clearfix">
									<span class="pull-left">
										<i class="btn btn-mini no-hover btn-success icon-shopping-cart"></i>
										New Orders
									</span>
									<span class="pull-right badge badge-success">+8</span>
								</div>
							</a>
						</li>

						<li>
							<a href="#">
								<div class="clearfix">
									<span class="pull-left">
										<i class="btn btn-mini no-hover btn-info icon-twitter"></i>
										Followers
									</span>
									<span class="pull-right badge badge-info">+11</span>
								</div>
							</a>
						</li>

						<li>
							<a href="#">
								See all notifications
								<i class="icon-arrow-right"></i>
							</a>
						</li>
					</ul>
				</li>

				<li class="green">
					<a data-toggle="dropdown" class="dropdown-toggle" href="#">
						<i class="icon-envelope icon-animated-vertical"></i>
						<span class="badge badge-success">5</span>
					</a>

					<ul class="pull-right dropdown-navbar dropdown-menu dropdown-caret dropdown-closer">
						<li class="nav-header">
							<i class="icon-envelope-alt"></i>
							5 Messages
						</li>

						<li>
							<a href="#">
								<img src="assets/avatars/avatar.png" class="msg-photo" alt="Alex's Avatar" />
								<span class="msg-body">
									<span class="msg-title">
										<span class="blue">Alex:</span>
										Ciao sociis natoque penatibus et auctor ...
									</span>

									<span class="msg-time">
										<i class="icon-time"></i>
										<span>a moment ago</span>
									</span>
								</span>
							</a>
						</li>

						<li>
							<a href="#">
								<img src="assets/avatars/avatar3.png" class="msg-photo" alt="Susan's Avatar" />
								<span class="msg-body">
									<span class="msg-title">
										<span class="blue">Susan:</span>
										Vestibulum id ligula porta felis euismod ...
									</span>

									<span class="msg-time">
										<i class="icon-time"></i>
										<span>20 minutes ago</span>
									</span>
								</span>
							</a>
						</li>

						<li>
							<a href="#">
								<img src="assets/avatars/avatar4.png" class="msg-photo" alt="Bob's Avatar" />
								<span class="msg-body">
									<span class="msg-title">
										<span class="blue">Bob:</span>
										Nullam quis risus eget urna mollis ornare ...
									</span>

									<span class="msg-time">
										<i class="icon-time"></i>
										<span>3:15 pm</span>
									</span>
								</span>
							</a>
						</li>

						<li>
							<a href="#">
								See all messages
								<i class="icon-arrow-right"></i>
							</a>
						</li>
					</ul>
				</li>

				<li class="light-blue">
					<? if (isset($this->User) && $this->User->GetActive()) { ?>
					<a data-toggle="dropdown" href="#" class="dropdown-toggle">
						<span class="user-info">
							<small>Welcome,</small> <?=$this->User->GetName(NULL, TRUE)?>
						</span>
						<i class="icon-caret-down"></i>
					</a>
					<ul class="user-menu pull-right dropdown-menu dropdown-yellow dropdown-caret dropdown-closer">
						<li><a href="/logout"><i class="icon-off"></i> Logout</a></li>
					</ul>
					<? } else { ?>
					<a href="/login"><i class="icon-user"></i> Login</a>
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
				<a href="/how-to" class="btn btn-small btn-success" data-tip-placement="right" data-tip="How to create a systematic review">
					<i class="icon-book"></i>
				</a>

				<a href="/libraries" class="btn btn-small btn-info" data-tip-placement="right" data-tip="View your reference libraries">
					<i class="icon-tags"></i>
				</a>

				<a class="btn btn-small btn-warning">
					<i class="icon-group"></i>
				</a>

				<a class="btn btn-small btn-danger">
					<i class="icon-cogs"></i>
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
						<a href="/">Home</a>
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
