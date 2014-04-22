<?php
/**
* Class to manage a variety of citation reference libraries
* @author Matt Carter <m@ttcarter.com>
* @see https://github.com/hash-bang/RefLib
*/
class RefLib {
	/**
	* An indexed or hash array of references
	* Each refernce has the following keys:
	*	* authors - Array of authors
	*	* address - String (optional)
	*	* contact-name - String (optional)
	*	* contact-email - String (optional)
	*	* title - String
	*	* title-secondary - String (optional)
	*	* title-short - String (optional)
	*	* periodical-title - String (optional)
	* 	* pages - String (optional)
	*	* volume - String (optional)
	*	* number - String (optional)
	*	* section - String (optional)
	*	* year - String (optional) - FIXME: Explain format
	*	* date - String (optional) - FIXME: Explain format
	*	* abstract - String (optional)
	*	* urls - Array
	*	* notes - String (optional)
	*	* research-notes - String (optional)
	*	* isbn - String (optional)
	*	* label - String (optional)
	*	* caption - String (optional)
	*	* language - String (optional)
	*	* custom{1..7} - String (optional)
	*
	* @var array
	*/
	var $refs = array();

	/**
	* When using SetXML() this field will be used as the ID to refer to the reference
	* If the ID does not exist for this reference an error will be raised
	* Meta types:
	*		NULL - Use next index offset (i.e. $this->refs will be an indexed array)
	*		rec-number - Use EndNotes own record number as a reference (only set this if you need to maintain EndNotes own record numbering against this libraries indexing)
	*
	* @var string|null
	*/
	var $refId = null;

	/**
	* The currently active driver for this instance
	* @var string
	*/
	var $driver = null;

	/**
	* Whether to apply htmlentitites() encoding during an export operation
	* @var bool
	*/
	var $escapeExport = true;

	/**
	* Whenever a fix is applied (See $applyFix*) any data that gets rewritten should be stored in $ref[]['RAW']
	* @type bool
	*/
	var $fixesBackup = false;

	/**
	* Enables the auto-fixing of reference.pages to be absolute
	* Some journals mangle the page references for certain references, this attempts to fix that during import
	* e.g. pp520-34 becomes 520-534
	* @see FixPages()
	* @var bool
	*/
	var $applyFixPages = true;

	// Constructor & magic methods {{{
	function __construct() {
		// Pass
	}

	/**
	* What functions should be transparently mapped onto the driver
	* All keys should be lower case with the values as the function name to pass onto
	* @var array
	*/
	var $_driverMaps = array(
		'getdefaultfilename' => 'GetDefaultFilename',
		'getcontents' => 'GetContents',
		'setcontents' => 'SetContents',
		'escape' => 'Escape',
	);

	/**
	* Magic methods - these usually map onto the driver
	*/
	function __call($method, $params) {
		if (isset($this->_driverMaps[strtolower($method)]))
			return call_user_func_array(array($this->driver, $method), $params);
		trigger_error("Invalid method: $method");
	}
	// }}}

	// Driver functions {{{
	function LoadDriver($driver) {
		$driver = strtolower($driver);
		require(dirname(__FILE__) . "/drivers/$driver.php");
		$driverName = "RefLib_" . ucfirst($driver);
		$this->driver = new $driverName();
		$this->driver->parent = $this;
	}

	/**
	* Tries to identify the correct driver to use based on an array of data
	* @param array $types,... An array of known data about the file. Usually this is the file extension (if any) and mime type
	* @return string Either a suitable driver name or boolean false
	*/
	function IdentifyDriver() {
		$types = func_get_args();
		foreach ($types as $type) {
			switch ($type) {
				case 'xml':
				case 'text/xml':
					return 'endnotexml';
			}
		}
	}
	// }}}

	// Adders / removers {{{
	function Reset() {
		$this->refs = array();
		$this->name = 'EndNote.enl';
		$this->escapeExport = true;
		$this->fixPages = true;
		$this->fixesBakup = false;
		$this->refId = null;
	}

	/**
	* Add a reference to the $refs array
	* This function also expands simple strings into arrays (suported: author => authors, url => urls)
	* @param $ref array The array to add to the stack
	*/
	function Add($ref) {
		// Expand singular -> plurals
		foreach (array(
			'author' => 'authors',
			'url' => 'urls',
		) as $single => $plural)
			if (isset($ref[$single])) {
				$ref[$plural] = array($ref[$single]);
				unset($ref[$single]);
			}
		$this->refs[] = $ref;
	}
	// }}}

	// Content getters / setters {{{
	/**
	* Generate an XML file and output it to the browser
	* This will force the user to save the file somewhere to be opened later by EndNote
	* @param string $filename The default filename to save as, if unspecifed the driver default will be used
	*/
	function DownloadContents($filename = null) {
		if (!$filename)
			$filename = $this->driver->GetDefaultFilename();
		header('Content-type: text/plain');
		header('Content-Disposition: attachment; filename="' . $filename . '"');
		echo $this->GetXML();
	}

	/**
	* Alias of SetContentsFile()
	* @see SetContentsFile()
	*/
	function SetContentFile($filename) {
		return $this->SetContentsFile($filename);
	}

	/**
	* Set the BLOB contents of the incomming citation library from a file
	* This function will also attempt to identify the correct driver to use (via IdentifyDriver())
	* @param string $filename The actual file path to load
	* @param string $mime Optional mime type informaton if the filename doesnt provide anything helpful (such as it originating from $_FILE)
	*/
	function SetContentsFile($filename, $mime = null) {
		if ($driver = $this->IdentifyDriver(pathinfo($filename, PATHINFO_EXTENSION), $mime)) {
			$this->LoadDriver($driver);
			$this->driver->SetContents(file_get_contents($filename));
		} else {
			trigger_error("Unknown driver type for filename '$filename'");
		}
	}
	// }}}

	// Fixes {{{
	/**
	* Apply all enabled features
	* This is really just one big switch that enables the $this->Fix* methods
	* @param array $ref The reference to fix
	* @return array $ref The now fixed reference
	*/
	function ApplyFixes($ref) {
		if ($this->applyFixPages)
			$ref = $this->FixPages($ref);
		return $ref;
	}

	/**
	* Fix reference.pages to be absolute
	* Some journals mangle the page references for certain references
	* NOTE: References beginning/ending with 'S' are left with that prefix as that denotes a section
	* e.g. pp520-34 becomes 520-534
	* @param array $ref The refernce object to fix
	* @return array $ref The fixed reference object
	*/
	function FixPages($ref) {
		if (!isset($ref['pages'])) // Nothing to do
			return $ref;

		$prefix = '';
		$pages = $ref['pages'];
		if (preg_match('/^s|s$/i', $ref['pages'])) { // Has an 'S' prefix or suffix
			$prefix = 'S';
			$pages = preg_replace('/^s|s$/i', '', $pages);
		}

		if (preg_match('/^([0-9]+)\s*-\s*([0-9]+)$/', $pages, $matches)) { // X-Y
			list($junk, $begin, $end) = $matches;
			if ((int) $begin == (int) $end) { // Really just a single page
				$pages = $begin;
			} elseif (strlen($end) < strlen($begin)) { // Relative lengths - e.g. 219-22
				$end = substr($begin, 0, strlen($begin) - strlen($end)) . $end;
				$pages = "$begin-$end";
			} else { // Already absolute range
				$pages = "$begin-$end";
			}
		} elseif (preg_match('/^([0-9]+)$/', $pages)) {
			$pages = (int) $pages;
		}

		$pages = $prefix . $pages;
		if ($ref['pages'] != $pages) { // Actually rewrite 'pages'
			if ($this->fixesBackup) {
				if (!isset($ref['RAW']))
					$ref['RAW'] = array();
				$ref['RAW']['pages'] = $ref['pages'];
			}
			$ref['pages'] = $pages;
		}
		$ref['TEST'] = array();
		return $ref;
	}
	// }}}
}
