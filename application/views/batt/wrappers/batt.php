<?
$this->site->Header($view);
require('lib/batt/src/batt_debug.php');
if (file_exists("application/views/batt/global.php"))
	$this->load->view('batt/global');
?>
<script type="batt">
<? include("application/views/batt/$view.batt") ?>
</script>
<?
$this->site->Footer();
?>
