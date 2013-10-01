<ul class="nav nav-list" data-selectbyurl="li" data-selectbyurl-parent="li">
	<li>
		<a href="<?=SITE_ROOT?>">
			<i class="icon-dashboard"></i> <span class="menu-text">Dashboard</span>
		</a>
	</li>

	<li>
		<a href="<?=SITE_ROOT?>search">
			<i class="icon-search"></i>
			<span class="menu-text"> Search</span>
		</a>
	<li>
		<a href="<?=SITE_ROOT?>how-to" class="dropdown-toggle">
			<i class="icon-book"></i>
			<span class="menu-text"> How to create a review</span>
			<b class="arrow icon-angle-down"></b>
		</a>
		<ul class="submenu">
			<? if (isset($this->Page)) { ?>
			<? foreach ($this->Page->GetSteps() as $i => $name) { ?>
			<li>
				<a href="<?=SITE_ROOT?>how-to/<?=$i+1?>">
					<i class="icon-double-angle-right"></i> <?=($i+1) . ". $name"?>
				</a>
			</li>
			<? } ?>
			<? } ?>
		</ul>
	</li>

	<?
	if (isset($this->Library, $this->User) && $this->User->GetActive()) {
		$basket = $this->Library->GetBasket();
	?>
	<li>
		<a href="<?=SITE_ROOT?>libraries" class="dropdown-toggle">
			<i class="icon-tags"></i>
			<span class="menu-text"> My references</span>
			<b class="arrow icon-angle-down"></b>
		</a>
		<ul class="submenu">
			<? if ($basket) { // Move reference basket to top ?>
			<li>
				<a href="<?=SITE_ROOT?>libraries/view/<?=$basket['libraryid']?>">
					<i class="icon-double-angle-right"></i> <i class="icon-shopping-cart"></i> <?=$basket['title']?>
				</a>
			</li>
			<? } ?>
			<?
			foreach ($this->Library->GetAll(array('userid' => $this->User->GetActive('userid'), 'status' => 'active')) as $library) {
				if ($library['libraryid'] == $basket['libraryid']) continue; // Skip the basket - which we displayed above
			?>
			<li>
				<a href="<?=SITE_ROOT?>libraries/view/<?=$library['libraryid']?>">
					<i class="icon-double-angle-right"></i> <?=$library['title']?>
				</a>
			</li>
			<? } ?>
			<li><a href="<?=SITE_ROOT?>libraries/import">
				<i class="icon-double-angle-right"></i> <i class="icon-plus"></i> Import New</a>
			</li>
		</ul>
	</li>
	<? } ?>

	<? if (isset($this->User) && !$this->User->GetActive()) { ?>
	<li>
		<a href="<?=SITE_ROOT?>login">
			<i class="icon-user"></i>
			<span class="menu-text"> Login</span>
		</a>
	</li>
	<? } ?>
</ul>

<div class="sidebar-collapse" id="sidebar-collapse">
	<i class="icon-double-angle-left"></i>
</div>
</div>
