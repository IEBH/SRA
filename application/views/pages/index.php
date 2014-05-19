<div class="pad">
	<div class="hero-unit">
		<h1><?=SITE_TITLE?></h1>
		<p>Welcome to the CREBP Systematic Review Creator</p>
		<? if ($this->User->GetActive()) { // Logged in ?>
		<div class="pad-top-huge pull-center">
			<a class="btn btn-large" href="/how-to"><i class="icon-book"></i> How to create a review</a>
			<a class="btn btn-large" href="/libraries"><i class="icon-tags"></i> View your Libraries</a>
		</div>
		<? } else { // Not logged in ?>
		<div class="pad-top-huge pull-center">
			<a class="btn btn-large" href="/signup"><i class="icon-asterisk"></i> Create an account</a>
			<a class="btn btn-large" href="/login"><i class="icon-user"></i> Login</a>
		</div>
		<? } ?>
	</div>
</div>
