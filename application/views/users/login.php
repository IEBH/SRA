<script>
$(function() {
	$('input[name=username]').select();
});
</script>
<body class="login-layout">
	<div class="main-container container-fluid">
		<div class="main-content">
			<div class="row-fluid">
				<div class="span12">
					<div class="login-container">
						<div class="row-fluid">
							<div class="center">
								<h4>
									<i class="icon-leaf green"></i>
									<span class="white"><?=SITE_TITLE?></span>
								</h4>
							</div>
						</div>

						<div class="space-6"></div>

						<div class="row-fluid">
							<div class="position-relative">
								<div id="login-box" class="login-box visible widget-box no-border">
									<div class="widget-body">
										<div class="widget-main">
											<h4 class="header blue lighter bigger">
												<i class="icon-coffee green"></i>
												Please Enter Your Information
											</h4>

											<div class="space-6"></div>

											<form action="/login" method="post">
												<fieldset>
													<label>
														<span class="block input-icon input-icon-right">
															<input type="text" class="span12" value="<?=isset($_POST['username']) ? $_POST['username'] : ''?>" name="username" placeholder="Username">
															<i class="icon-user"></i>
														</span>
													</label>

													<label>
														<span class="block input-icon input-icon-right">
															<input type="password" name="password" class="span12" placeholder="Password" />
															<i class="icon-lock"></i>
														</span>
													</label>

													<div class="space"></div>

													<div class="clearfix pull-center">
														<button type="submit" class="width-35 btn btn-small btn-primary">
															<i class="icon-key"></i>
															Login
														</button>
													</div>

													<div class="space-4"></div>
												</fieldset>
											</form>
										</div><!--/widget-main-->

										<div class="toolbar clearfix">
											<div>
												<a href="<?=SITE_ROOT?>recover/password" return false;" class="forgot-password-link">
													<i class="icon-arrow-left"></i>
													I forgot my password
												</a>
											</div>

											<div>
												<a href="<?=SITE_ROOT?>signup" onclick="show_box('signup-box'); return false;" class="user-signup-link">
													I want to register
													<i class="icon-arrow-right"></i>
												</a>
											</div>
										</div>
									</div><!--/widget-body-->
								</div><!--/login-box-->
							</div><!--/position-relative-->
						</div>
					</div>
				</div><!--/.span-->
			</div><!--/.row-fluid-->
		</div>
	</div><!--/.main-container-->
</body>
