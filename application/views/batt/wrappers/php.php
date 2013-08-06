<?
$this->site->Header($view);
require('lib/batt/src/batt_debug.php');
$this->load->view("batt/$view");
$this->site->Footer();
