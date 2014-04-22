RefLib
======
PHP module for managing a variety of citation reference libraries.

At present this library can read/write the following citation library formats:

* EndNote (XML)
* RIS (under testing, coming soon)


Installation
------------
The easiest way to install is via Composer - `composer require hashbang/reflib`

If you wish to install *without* composer then download the source code, unzip it into a directory include the file in the normal way.


Examples
========

Example: Read in EndNote XML
----------------------------

	require('reflib.php');
	$lib = new RefLib();
	$lib->SetContentsFile('an-endnote-file.xml');

	print_r($lib->refs); // Outputs all processed refs in an associative array


Example: Write EndNote XML
--------------------------

	require('reflib.php');
	$lib = new RefLib();
	$lib->SetContentsFile('an-endnote-file.xml'); // Read in content (or populate $lib->refs yourself)
	$lib->OutputXML('EndNote File.xml'); // Output file to the browser
