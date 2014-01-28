<?
/**
* Simple class to read and write EndNote XML files
*
* @author Matt Carter <m@ttcarter.com>
*/
class PHPEndNote {
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
	* @var string|null
	*/
	var $refId = null;

	/**
	* The internal name to call the file
	* As far as I am aware this does not actually serve a purpose but EndNote refuses to import the file unless its specified
	* @var string
	*/
	var $name = 'EndNote.enl';

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

	// Constructor
	function __construct() {
		// Pass
	}

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

	/**
	* Escpe a string in an EndNote compatible way
	* @param string $string The string to be escaped
	* @return string The escaped string
	*/
	function Escape($string) {
		return strtr($string, array(
			"\r" => '&#13;',
			'&' => '&amp;',
			'<' => '&lt;',
			'>' => '&gt;',
		));
	}

	/**
	* Internal function to optionally escape strings based on $escapeExport
	* @param string $string The string to return, optionally escaped
	* @return string The optionally escaped string
	* @see $escapeExport
	*/
	function _export($string) {
		return $this->escapeExport ? $this->Escape($string) : $string;
	}

	/**
	* Return the raw XML of the $refs array
	* @see $refs
	*/
	function GetXML() {
		$out = '<' . '?xml version="1.0" encoding="UTF-8"?' . '><xml><records>';
		$number = 0;
		foreach ($this->refs as $id => $ref) {
			$out .= '<record>';
			$out .= '<database name="' . $this->name . '" path="C:\\' . $this->name . '">' . $this->_export($this->name) . '</database>';
			$out .= '<source-app name="EndNote" version="16.0">EndNote</source-app>';
			$out .= '<rec-number>' . $number . '</rec-number>';
			$out .= '<foreign-keys><key app="EN" db-id="s55prpsswfsepue0xz25pxai2p909xtzszzv">' . $number . '</key></foreign-keys>';
			$out .= '<ref-type name="Journal Article">17</ref-type>';

			$out .= '<contributors><authors>';
				foreach ($ref['authors'] as $author)
					$out .= '<author><style face="normal" font="default" size="100%">' . $this->_export($author) . '</style></author>';
			$out .= '</authors></contributors>';

			$out .= '<titles>';
				$out .= '<title><style face="normal" font="default" size="100%">' . $this->_export($ref['title']) . '</style></title>';
				$out .= '<secondary-title><style face="normal" font="default" size="100%">' . (isset($ref['title-secondary']) && $ref['title-secondary'] ? $this->_export($ref['title-secondary']) : '') . '</style></secondary-title>';
				if (isset($ref['title-short']) && $ref['title-short'])
					$out .= '<short-title><style face="normal" font="default" size="100%">' . $this->_export($ref['title-short']) . '</style></short-title>';
			$out .= '</titles>';

				$out .= '<periodical><full-title><style face="normal" font="default" size="100%">' . (isset($ref['periodical-title']) && $ref['periodical-title'] ? $this->_export($ref['periodical-title']) : '') . '</style></full-title></periodical>';

			// Simple key values
			foreach (array(
				'auth-address' => 'address',
				'pages' => 'pages',
				'volume' => 'volume',
				'number' => 'number',
				'section' => 'section',
				'abstract' => 'abstract',
				'isbn' => 'isbn',
				'label' => 'label',
				'caption' => 'caption',
				'language' => 'language',
				'notes' => 'notes',
				'research-notes' => 'research-notes',
				'custom1' => 'custom1',
				'custom2' => 'custom2',
				'custom3' => 'custom3',
				'custom4' => 'custom4',
				'custom5' => 'custom5',
				'custom6' => 'custom6',
				'custom7' => 'custom7',
			) as $enkey => $ourkey)
				if (isset($ref[$ourkey]) && $ref[$ourkey])
					$out .= "<$enkey><style face=\"normal\" font=\"default\" size=\"100%\">" . $this->_export($ref[$ourkey]) . "</style></$enkey>";

			$out .= '<dates>';
				$out .= '<year><style face="normal" font="default" size="100%">' . (isset($ref['year']) && $ref['year'] ? $this->_export($ref['year']) : '') . '</style></year>';
				$out .= '<pub-dates><date><style face="normal" font="default" size="100%">' . (isset($ref['date']) && $ref['date'] ? $this->_export($ref['date']) : '') . '</style></date></pub-dates>';
			$out .= '</dates>';

			if (isset($ref['urls']) && $ref['urls']) {
				$out .= '<urls><related-urls>';
					foreach ($ref['urls'] as $url)
						$out .= '<url><style face="normal" font="default" size="100%">' . $this->_export($url) . '</style></url>';
				$out .= '</related-urls></urls>';
			}

			$out .= '</record>';
			$number++;
		}
		$out .= '</records></xml>';
		return $out;
	}

	/**
	* Generate an XML file and output it to the browser
	* This will force the user to save the file somewhere to be opened later by EndNote
	* @param string $filename The default filename to save as
	*/
	function OutputXML($filename = 'EndNote.xml') {
		header('Content-type: text/plain');
		header('Content-Disposition: attachment; filename="' . $filename . '"');
		echo $this->GetXML();
	}

	function SetXML($xml) {
		$dom = new SimpleXMLElement($xml);
		foreach ($dom->records->record as $record) {
			$ref = array(
				'authors' => array(),
				'urls' => array(),
				'title' => '',
			);
			foreach ($record->xpath('contributors/authors/author/style/text()') as $authors) 
				$ref['authors'][] = end($authors);

			foreach ($record->xpath('urls/related-urls/url/style/text()') as $url) 
				$ref['urls'][] = end($url);

			if ($find = $record->xpath("titles/title/style/text()"))
				$ref['title'] = end(current($find));
			if ($find = $record->xpath("titles/secondary-title/style/text()"))
				$ref['title-secondary'] = end(current($find));
			if ($find = $record->xpath("titles/short-title/style/text()"))
				$ref['title-short'] = end(current($find));
			if ($find = $record->xpath("periodical/full-title/style/text()"))
				$ref['periodical-title'] = end(current($find));
			if ($find = $record->xpath("dates/year/style/text()"))
				$ref['year'] = end(current($find));
			if ($find = $record->xpath("dates/pub-dates/date/style/text()"))
				$ref['date'] = end(current($find));

			// Simple key=>vals
			foreach (array(
				'auth-address' => 'address',
				'pages' => 'pages',
				'volume' => 'volume',
				'number' => 'number',
				'section' => 'section',
				'abstract' => 'abstract',
				'isbn' => 'isbn',
				'notes' => 'notes',
				'research-notes' => 'research-notes',
				'label' => 'label',
				'caption' => 'caption',
				'language' => 'language',
				'custom1' => 'custom1',
				'custom2' => 'custom2',
				'custom3' => 'custom3',
				'custom4' => 'custom4',
				'custom5' => 'custom5',
				'custom6' => 'custom6',
				'custom7' => 'custom7',
			) as $enkey => $ourkey) {
				if (! $find = $record->xpath("$enkey/style/text()") )
					continue;
				$ref[$ourkey] = end(current($find));
			}
			$ref = $this->ApplyFixes($ref);

			if (!$this->refId) { // Use indexed array
				$this->refs[] = $ref;
			} elseif (is_string($this->refId)) { // Use assoc array
				if (!isset($ref[$this->refId])) {
					trigger_error("No ID found in reference to use as key");
				} else {
					$this->refs[$ref[$this->refId]] = $ref;
				}
			}
		}
	}

	function SetXMLFile($filename) {
		$this->SetXML(file_get_contents($filename));
	}

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
}
