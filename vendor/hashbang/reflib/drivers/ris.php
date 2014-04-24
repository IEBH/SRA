<?php
/**
* RIS driver for RefLib
*
* NOTE: This driver for RefLib has only limited support for RIS fields, usually because the RIS fields don't map onto the standard RegLib ones correctly
*/
class RefLib_ris {
	var $driverName = 'RIS';

	/**
	* The parent instance of the RefLib class
	* @var class
	*/
	var $parent;

	/**
	* Escpe a string in an EndNote compatible way
	* @param string $string The string to be escaped
	* @return string The escaped string
	*/
	function Escape($string) {
		return $string;
	}

	/**
	* Computes the default filename if given a $salt
	* @param string $salt The basic part of the filename to use
	* @return string The filename including extension to use as default
	*/
	function GetFilename($salt = 'RIS') {
		return "$salt.ris";
	}

	function GetContents() {
	}

	function SetContents($blob) {
		if (!preg_match_all('!^TY  - (.*?)\n(.*?)^ER  -!ms', $blob, $matches, PREG_SET_ORDER))
			return;
		$recno = 0;
		foreach ($matches as $match) {
			$recno++;
			$ref = array('type' => strtolower($match[1]));

			$rawref = array();
			preg_match_all('!^([A-Z]{2})  - (.*)$!m', $match[2], $rawrefextracted, PREG_SET_ORDER);
			foreach ($rawrefextracted as $rawrefbit)
				$rawref[$rawrefbit[1]] = $rawrefbit[2];

			// Authors {{{
			$ref['authors'] = array();
			foreach (array('AU', 'A2', 'A3', 'A4') as $k)
				if (isset($rawref[$k]))
					$ref['authors'][] = $rawref[$k];
			$ref['authors'] = implode(' AND ', $ref['authors']);
			// }}}
			// Simple key/val mappings {{{
			foreach (array(
				'CA' => 'caption',
				'J2' => 'title-secondary',
				'C1' => 'custom1',
				'C2' => 'custom2',
				'C3' => 'custom3',
				'C4' => 'custom4',
				'C5' => 'custom5',
				'C6' => 'custom6',
				'C7' => 'custom7',
				'C8' => 'custom8',
				'LA' => 'language',
				'LB' => 'label',
				'N1' => 'notes',
				'SE' => 'section',
				'SN' => 'isbn',
				'ST' => 'title-short',
				'TI' => 'title',
				'VL' => 'volume',
			) as $ris => $reflib)
				if (isset($rawref[$ris]))
					$ref[$reflib] = $rawref[$ris];
			// }}}
			// Simple key/val(array) mappings {{{
			foreach (array(
				'DO' => 'urls',
				'UR' => 'urls',
			) as $ris => $reflib) {
				if (isset($rawref[$ris])) {
					if (!isset($ref[$reflib]))
						$ref[$reflib] = array();
					$ref[$reflib][] = $rawref[$ris];
				}
			}
			// }}}
			// Pages {{{
			if (isset($rawref['SP']) && isset($rawref['EP'])) {
				$ref['pages'] = "{$rawref['SP']}-{$rawref['EP']}";
			} elseif (isset($rawref['SP']))
				$ref['pages'] = $rawref['SP'];
			// }}}
			// Dates {{{
			if (isset($rawref['PY']))
				if (preg_match('!([0-9]{4})///!', $rawref['PY'], $date)) { // Just year
					$ref['year'] = $date[1];
				} elseif (preg_match('!([0-9]{4})/([0-9]{1,2})//!', $rawref['PY'], $date)) { // Just month
					$ref['date'] = strtotime("{$date[1]}-{$date[2]}-01");
				} elseif (preg_match('!([0-9]{4})/([0-9]{1,2})/([0-9]{1,2})/!', $rawref['PY'], $date)) // Full date
					$ref['date'] = strtotime("{$date[1]}-{$date[2]}-{$date[1]}");
			// }}}

			// Append to $this->parent->refs {{{
			if (!$this->parent->refId) { // Use indexed array
				$this->parent->refs[] = $ref;
			} elseif (is_string($this->parent->refId)) { // Use assoc array
				if ($this->parent->refId == 'rec-number') {
					$this->parent->$refs[$recno] = $ref;
				} elseif (!isset($ref[$this->parent->refId])) {
					trigger_error("No ID found in reference to use as key");
				} else {
					$this->parent->refs[$ref[$this->parent->refId]] = $ref;
				}
			}
			// }}}
		}
	}
}
