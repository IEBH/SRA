<?
/**
* Enable Batt debug mode by correctly working out where the hell we are and including the right JS files
* @param $batt_root string Overriding root directory of where this project is located in the file system (default: '/')
* @param $batt_load array An array of the different modules to load in (booleans). See below for values
*/
if (!isset($batt_root))
	$batt_root = '/';

if (!isset($batt_load)) // Nothing specified - assume...
	$batt_load = array(
		'bootstrap' => true,
		'jquery' => true,
		'script' => true,
		'mustache' => true,
	);

$mydir = explode('/', dirname(__FILE__));
$cwd = explode('/', getcwd());

// Where are we relative to the cwd()
$batt_path = implode('/', array_slice($mydir, count(array_intersect($mydir, $cwd)), -1));
if ($batt_path) // Prefix with '/' if it is actually something other than root
	$batt_path = "$batt_root$batt_path";
?>
	<? if ($batt_load['jquery']) { ?>
	<script src="<?=$batt_path?>/lib/jquery-1.9.1.min.js"></script>
	<? } ?>
	<? if ($batt_load['bootstrap']) { ?>
	<link href="<?=$batt_path?>/lib/bootstrap-combined.min.css" rel="stylesheet">
	<link href="<?=$batt_path?>/lib/bootstrap-responsive.min.css" rel="stylesheet">
	<script src="<?=$batt_path?>/lib/bootstrap.min.js"></script>
	<? } ?>
	<? if ($batt_load['script']) { ?>
	<script src="<?=$batt_path?>/lib/script.min.js"></script>
	<? } ?>
	<? if ($batt_load['mustache']) { ?>
	<script src="<?=$batt_path?>/lib/mustache.js"></script>
	<? } ?>

	<script type="text/javascript" src="<?=$batt_path?>/src/batt_object.js"></script>
	<script type="text/javascript" src="<?=$batt_path?>/src/batt_date.js"></script>
	<script type="text/javascript" src="<?=$batt_path?>/src/batt_choice.js"></script>
	<script type="text/javascript" src="<?=$batt_path?>/src/batt_choice_radio.js"></script>

	<script type="text/javascript" src="<?=$batt_path?>/src/batt_container.js"></script>
	<script type="text/javascript" src="<?=$batt_path?>/src/batt_container_splitter.js"></script>

	<script type="text/javascript" src="<?=$batt_path?>/src/batt_feed.js"></script>
	<script type="text/javascript" src="<?=$batt_path?>/src/batt_feed_batt.js"></script>

	<script type="text/javascript" src="<?=$batt_path?>/src/batt_dropdown.js"></script>
	<script type="text/javascript" src="<?=$batt_path?>/src/batt_form.js"></script>
	<script type="text/javascript" src="<?=$batt_path?>/src/batt_reference.js"></script>
	<script type="text/javascript" src="<?=$batt_path?>/src/batt_table.js"></script>
	<script type="text/javascript" src="<?=$batt_path?>/src/batt_tabs.js"></script>

	<script type="text/javascript" src="<?=$batt_path?>/src/batt_input.js"></script>
	<script type="text/javascript" src="<?=$batt_path?>/src/batt_label.js"></script>
	<script type="text/javascript" src="<?=$batt_path?>/src/batt_string.js"></script>
	<script type="text/javascript" src="<?=$batt_path?>/src/batt_number.js"></script>
	<script type="text/javascript" src="<?=$batt_path?>/src/batt_text.js"></script>

	<script type="text/javascript" src="<?=$batt_path?>/src/batt_file.js"></script>
	<script type="text/javascript" src="<?=$batt_path?>/src/batt_heading.js"></script>
	<script type="text/javascript" src="<?=$batt_path?>/src/batt_html.js"></script>

	<script type="text/javascript" src="<?=$batt_path?>/src/batt_link.js"></script>
	<script type="text/javascript" src="<?=$batt_path?>/src/batt_button.js"></script>
	<script type="text/javascript" src="<?=$batt_path?>/src/batt_tag.js"></script>

	<script type="text/javascript" src="<?=$batt_path?>/src/batt_unknown.js"></script>

	<script type="text/javascript" src="<?=$batt_path?>/src/batt.js"></script>
