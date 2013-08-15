<?php  if ( ! defined('BASEPATH')) exit('No direct script access allowed');
// CodeIgniter constants {{{
/*
|--------------------------------------------------------------------------
| File and Directory Modes
|--------------------------------------------------------------------------
|
| These prefs are used when checking and setting modes when working
| with the file system.  The defaults are fine on servers with proper
| security, but you may wish (or even need) to change the values in
| certain environments (Apache running a separate process for each
| user, PHP under CGI with Apache suEXEC, etc.).  Octal values should
| always be used to set the mode correctly.
|
*/
define('FILE_READ_MODE', 0644);
define('FILE_WRITE_MODE', 0666);
define('DIR_READ_MODE', 0755);
define('DIR_WRITE_MODE', 0777);

/*
|--------------------------------------------------------------------------
| File Stream Modes
|--------------------------------------------------------------------------
|
| These modes are used when working with fopen()/popen()
|
*/

define('FOPEN_READ',							'rb');
define('FOPEN_READ_WRITE',						'r+b');
define('FOPEN_WRITE_CREATE_DESTRUCTIVE',		'wb'); // truncates existing file data, use with care
define('FOPEN_READ_WRITE_CREATE_DESTRUCTIVE',	'w+b'); // truncates existing file data, use with care
define('FOPEN_WRITE_CREATE',					'ab');
define('FOPEN_READ_WRITE_CREATE',				'a+b');
define('FOPEN_WRITE_CREATE_STRICT',				'xb');
define('FOPEN_READ_WRITE_CREATE_STRICT',		'x+b');
// }}}

define('VERSION', '0.1.0');

define('SITE_ROOT', preg_match('/^local/', $_SERVER['SERVER_NAME']) ? '/' : '/searchtool/');
define('SITE_TITLE', 'CREBP Systematic Review Creator');

// De-duplication options
define('DEDUPE_ORDERBY', 'referenceid'); // What to order references by
define('DEDUPE_MAX_TIME', 4); // Maximum  amount of time (seconds) to let the process run
define('DEDUPE_SCOOP_REFERENCES', 10); // Number of references to read into memory at once to analyze (i.e. ref A)
define('DEDUPE_SCOOP_REFERENCES2', 50); // Number of secondary references to read into memory at once to analyze (i.e. ref A <=> B)
