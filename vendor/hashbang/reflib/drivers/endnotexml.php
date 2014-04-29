<?php
/**
* EndNote XML driver for RefLib
*/
class RefLib_endnotexml {
	var $driverName = 'EndNoteXML';

	/**
	* The parent instance of the RefLib class
	* @var class
	*/
	var $parent;

	/**
	* Whether to apply htmlentitites() encoding during an export operation
	* @var bool
	*/
	var $escapeExport = true;

	/**
	* The internal name to call the file
	* As far as I am aware this does not actually serve a purpose but EndNote refuses to import the file unless its specified
	* @var string
	*/
	var $endNoteFile = 'EndNote.enl';

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
	* Computes the default filename if given a $salt
	* @param string $salt The basic part of the filename to use
	* @return string The filename including extension to use as default
	*/
	function GetFilename($salt = 'EndNote') {
		return "$salt.xml";
	}

	/**
	* Return the raw XML of the $refs array
	* @see $refs
	*/
	function GetContents() {
		$out = '<' . '?xml version="1.0" encoding="UTF-8"?' . '><xml><records>';
		$number = 0;
		foreach ($this->parent->refs as $id => $ref) {
			$out .= '<record>';
			$out .= '<database name="' . $this->endNoteFile . '" path="C:\\' . $this->endNoteFile . '">' . $this->_export($this->endNoteFile) . '</database>';
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
				$out .= '<pub-dates><date><style face="normal" font="default" size="100%">' . (isset($ref['date']) && $ref['date'] ? $this->_export($this->parent->ToDate($ref['date'])) : '') . '</style></date></pub-dates>';
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

	function SetContents($xml) {
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
				$ref['date'] = $this->parent->ToEpoc(end(current($find)), $ref);

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
			$ref = $this->parent->ApplyFixes($ref);

			if (!$this->parent->refId) { // Use indexed array
				$this->parent->refs[] = $ref;
			} elseif (is_string($this->parent->refId)) { // Use assoc array
				if ($this->parent->refId == 'rec-number') {
					// Stupidly convert the XML object into an array - wish there were some easier way to do this but xPath doesnt seem to watch to match 'rec-number/text()'
					$recArr = (array) $record;
					$recno = (int) $recArr['rec-number'];
					if (!$recno) {
						trigger_error('No record number to associate reference to');
						$this->parent->refs[$ref[$this->parent->refId]] = $ref;
					} else {
						$this->parent->refs[$recno] = $ref;
					}
				} elseif (!isset($ref[$this->parent->refId])) {
					trigger_error("No ID found in reference to use as key");
				} else {
					$this->parent->refs[$ref[$this->parent->refId]] = $ref;
				}
			}
		}
		if ($this->parent->refId == 'rec-number') // Resort by keys so that everything is in order
			ksort($this->parent->refs);
	}

}
