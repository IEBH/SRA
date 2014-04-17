<?php  if ( ! defined('BASEPATH')) exit('No direct script access allowed');
$autoload['packages'] = array();
$autoload['libraries'] = array('site', 'database');
$autoload['helper'] = array();
$autoload['config'] = array();
$autoload['language'] = array();
$autoload['model'] = array('User', 'Page', 'Library', 'Reference', 'Log', 'Format', 'Security');

// Composer
require('vendor/autoload.php');
include('vendor/hashbang/pherl/lib/pherl.php');
