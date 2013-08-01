<?php
/**
* Very very simple script to return a database feed as a JSON object
* WARNING: This script comes with absolutely no security whatsoever - use at your own risk!
* WARNING (AGAIN): No provision is made for SQL-Injection attacks, overflow attacks, dragons, evil wizards or Nazgûl.
* Use at your own risk.
*/

define('DB_SERVER', 'localhost');
define('DB_DATABASE', 'hylc');
define('DB_USER', 'mc');
define('DB_PASS', '');

mysql_connect(DB_SERVER, DB_USER, DB_PASS) or die("Could not connect: " . mysql_error());
mysql_select_db(DB_DATABASE);

if (!isset($_REQUEST['query']))
	die('No query specified');

$json = array(
	'header' => array(
	),
	'results' => array(),
);

$result = mysql_query($_REQUEST['query']);
while ($row = mysql_fetch_assoc($result)) {
	$json['results'][] = $row;
}

header("Expires: Mon, 26 Jul 1997 05:00:00 GMT" ); 
header("Last-Modified: " . gmdate( "D, d M Y H:i:s" ) . "GMT" ); 
header("Cache-Control: no-cache, must-revalidate" ); 
header("Pragma: no-cache" );
header('Content-type: application/json');
echo json_encode($result);
