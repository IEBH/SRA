<?php  if ( ! defined('BASEPATH')) exit('No direct script access allowed');
$route['default_controller'] = "pages";
$route['404_override'] = '';

$route['designer'] = 'pages/designer';

$route['batt/api/(:any)'] = 'batt/JSON$1';
$route['batt/(:any)'] = 'batt/show/$1';

// Work around PHP's stupid stipulation that List() is a reserved word
// */list -> #/all
$route['(:any)/list'] = '$1/all';
$route['(:any)/list/(:any)'] = '$1/all/$2';
