<ul class="nav nav-list" data-selectbyurl="li" data-selectbyurl-parent="li">
	<li>
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

	<li>
		<a href="/libraries" class="dropdown-toggle">
			<i class="icon-tag"></i>
			<span class="menu-text"> My references </span>
			<b class="arrow icon-angle-down"></b>
		</a>
		<ul class="submenu">
			<li>
				<a href="#" class="dropdown-toggle">
					<i class="icon-double-angle-right"></i> Tools
					<b class="arrow icon-angle-down"></b>
				</a>
				<ul class="submenu">
					<li><a href="/libraries/import">Import New</a></li>
				</ul>
			</li>
			<? if (isset($this->Library)) { ?>
			<? foreach ($this->Library->GetAll(array('userid' => $this->User->GetActive('userid'))) as $library) { ?>
			<li>
				<a href="/libraries/view/<?=$library['libraryid']?>">
					<i class="icon-double-angle-right"></i> <?=$library['title']?>
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
