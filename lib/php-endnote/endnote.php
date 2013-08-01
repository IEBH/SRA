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
	*	* isbn - String (optional)
	*
	* @var array
	*/
	var $refs;

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
	* Return the raw XML of the $refs array
	* @see $refs
	*/
	function GetXML() {
		$out = '<?xml version="1.0" encoding="UTF-8"?><xml><records>';
		$number = 0;
		foreach ($this->refs as $id => $ref) {
			$out .= '<record>';
			$out .= '<database name="CREBP-SearchTool.enl" path="C:\CREBP-SearchTool.enl">CREBP-SearchTool.enl</database>';
			$out .= '<source-app name="EndNote" version="16.0">EndNote</source-app>';
			$out .= '<rec-number>' . $number . '</rec-number>';
			$out .= '<foreign-keys><key app="EN" db-id="s55prpsswfsepue0xz25pxai2p909xtzszzv">' . $number . '</key></foreign-keys>';
			$out .= '<ref-type name="Journal Article">17</ref-type>';

			$out .= '<contributors><authors>';
				foreach ($ref['authors'] as $author)
					$out .= '<author><style face="normal" font="default" size="100%">' . $author . '</style></author>';
			$out .= '</authors></contributors>';

			$out .= '<titles>';
				$out .= '<title><style face="normal" font="default" size="100%">' . $ref['title'] . '</style></title>';
				$out .= '<secondary-title><style face="normal" font="default" size="100%">' . (isset($ref['title-secondary']) && $ref['title-secondary'] ? $ref['title-secondary'] : '') . '</style></secondary-title>';
				$out .= '<short-title><style face="normal" font="default" size="100%">' . (isset($ref['title-short']) && $ref['title-short'] ? $ref['title-short'] : '') . '</style></short-title>';
			$out .= '</titles>';

				$out .= '<periodical><full-title><style face="normal" font="default" size="100%">' . (isset($ref['periodical-title']) && $ref['periodical-title'] ? $ref['periodical-title'] : '') . '</style></full-title></periodical>';

			// Simple key values
			foreach (array(
				'auth-address' => 'address',
				'pages' => 'pages',
				'volume' => 'volume',
				'number' => 'number',
				'section' => 'section',
				'abstract' => 'abstract',
				'isbn' => 'isbn',
			) as $enkey => $ourkey)
				$out .= "<$enkey><style face=\"normal\" font=\"default\" size=\"100%\">" . (isset($ref[$ourkey]) && $ref[$ourkey] ? $ref[$ourkey] : '') . "</style></$enkey>";

			$out .= '<dates>';
				$out .= '<year><style face="normal" font="default" size="100%">' . (isset($ref['year']) && $ref['year'] ? $ref['year'] : '') . '</style></year>';
				$out .= '<pub-dates><date><style face="normal" font="default" size="100%">' . (isset($ref['year']) && $ref['year'] ? $ref['year'] : '') . '</style></date></pub-dates>';
			$out .= '</dates>';

			if (isset($ref['urls']) && $ref['urls']) {
				$out .= '<urls><related-urls>';
					foreach ($ref['urls'] as $url)
						$out .= '<url><style face="normal" font="default" size="100%">' . $url . '</style></url>';
				$out .= '</related-urls></urls>';
			}

			$out .= '<research-notes><style face="normal" font="default" size="100%">' . (isset($ref['notes']) && $ref['notes'] ? $ref['notes'] : '') . '</style></research-notes>';

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
				'research-notes' => 'notes',
			) as $enkey => $ourkey) {
				if (! $find = $record->xpath("$enkey/style/text()") )
					continue;
				$ref[$ourkey] = end(current($find));
			}
			$this->refs[] = $ref;
		}
	}

	function SetXMLFile($filename) {
		$this->SetXML(file_get_contents($filename));
	}
}
