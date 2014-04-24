<?
$dir = dirname(__FILE__);
require_once("$dir/../reflib.php");

$rl = new RefLib();
$rl->SetContentFile("$dir/data/ris.ris");
echo (count($rl->refs) == 101 ? 'PASS' : 'FAIL') . " - 101 references read from EndNote XML file\n";
