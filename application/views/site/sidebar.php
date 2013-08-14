<ul class="nav nav-list">
	<li class="active">
		<a href="/">
			<i class="icon-dashboard"></i> <span class="menu-text">Dashboard</span>
		</a>
	</li>

	<li>
		<a href="/how-to" class="dropdown-toggle">
			<i class="icon-book"></i>
			<span class="menu-text"> How to create a review </span>
			<b class="arrow icon-angle-down"></b>
		</a>
		<ul class="submenu">
			<? if (isset($this->Page)) { ?>
			<? foreach ($this->Page->GetSteps() as $i => $name) { ?>
			<li>
				<a href="/how-to/<?=$i+1?>">
					<i class="icon-double-angle-right"></i> <?=($i+1) . ". $name"?>
				</a>
			</li>
			<? } ?>
			<? } ?>
		</ul>
	</li>
</ul>

<div class="sidebar-collapse" id="sidebar-collapse">
	<i class="icon-double-angle-left"></i>
</div>
</div>
