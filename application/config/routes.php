<?php  if ( ! defined('BASEPATH')) exit('No direct script access allowed');
$route['default_controller'] = "pages";
$route['404_override'] = '';

$route['designer'] = 'pages/designer';

$route['login'] = 'users/login';
$route['logout'] = 'users/logout';
$route['signup'] = 'users/signup';
$route['recover'] = 'users/recover';
$route['recover/(:any)'] = 'users/recover';

$route['how-to'] = 'pages/howto';
$route['how-to/(:any)'] = 'pages/howto/$1';

// Search modules
$route['search/(:any)'] = '$1';

// Simple page aliases

// Batt
$route['batt/api/(:any)'] = 'batt/JSON$1';
$route['batt/(:any)'] = 'batt/show/$1';

// Rewrite API prefix to URLS - /api/$controller/$method -> /$controller/JSON{$method}
$route['api/(:any)/(:any)'] = '$1/JSON$2';

// Work around PHP's stupid stipulation that List() is a reserved word
// */list -> #/all
$route['(:any)/list'] = '$1/all';
$route['(:any)/list/(:any)'] = '$1/all/$2';
