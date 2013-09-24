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

// FIXME: Overrides for NPM modules
$batt_load['mustache'] = false;

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

	<script src="<?=$batt_path?>/batt.js"></script>
	<script>
	batt.path = '<?=$batt_path?>';
	</script>
