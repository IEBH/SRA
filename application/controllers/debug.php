<?
class Debug extends CI_Controller {
	function Index() {
		$this->site->Header('Debug information');
		$this->site->view('debug/debug');
		$this->site->Footer();
	}

	function Phpinfo() {
		phpinfo();
	}

	function Theme() {
		$this->site->Header('Test Theme Page');
		$this->site->view('debug/theme');
		$this->site->Footer();
	}

	function Error() {
		$this->site->Error('This is an error');
	}

	function Text() {
		$this->site->Error('This is some text', TRUE);
	}

	function Compare($a, $b) {
		$this->load->Model('Reference');
		if (! $aref = $this->Reference->Get($a))
			$this->site->Error("Invalid reference for A");
		if (! $bref = $this->Reference->Get($b))
			$this->site->Error("Invalid reference for B");

		$this->site->Header('Compare refs');
		$this->site->view('debug/console', array(
			'text' => 
				'A = ' . print_r($aref, 1) . "\n\n"
				. 'B = ' . print_r($bref, 1) . "\n\n"
				. 'Compare = ' . print_r($this->Reference->Compare($aref, $bref), 1)
		));
		$this->site->Footer();
	}

	function Batt() {
		echo "<pre>";
		$this->batt->read('application/views/libraries/share.php');
	}

	function Backport() {
		$this->load->model('Reference');
		require('lib/php-endnote/endnote.php');
	
		// Alloc $myrefs[caption] lookup hash {{{
		set_time_limit(0);
		$myrefsraw = $this->Reference->GetAll();
		$myrefs = array();
		foreach ($myrefsraw as $ref) {
			$ref = $this->Reference->Explode($ref);
			$myrefs[$ref['caption']] = $ref;
		}
		// }}}

		$this->endnote = new PHPEndNote();
		$this->endnote->SetXMLFile('data/John/131120 TEST IMPORT.xml');
		foreach ($this->endnote->refs as $refno => $ref) {
			if (isset($myrefs[$ref['caption']])) {
				switch ($myrefs[$ref['caption']]['status']) {
					case 'active':
						$ref['language'] = 'OK';
						break;
					case 'dupe':
						$ref['language'] = 'DUPE';
						break;
					case 'deleted':
						$ref['language'] = 'DELETED';
						break;
					default:
						$ref['language'] = 'ERROR';
				}
			}
			$this->endnote->refs[$refno] = $ref; // Save back
		}
		$this->endnote->OutputXML();
	}

	
	/**
	* Copies the field 'authors' from one XML file to another and returns the output as a third
	*/
	function BackportCopy() {
		$this->load->model('Reference');
		require('lib/php-endnote/endnote.php');
	
		$this->source = new PHPEndNote();
		$this->source->refId = 'caption';
		$this->source->SetXMLFile('data/John/A057 - Post SRA Friday 27-11-2013.xml');

		$this->dest = new PHPEndNote();
		$this->dest->refId = 'caption';
		$this->dest->SetXMLFile('data/John/131120 TEST IMPORT-OUT.xml');

		foreach ($this->dest->refs as $refid => $ref) {
			if (isset($this->source->refs[$refid])) {
				if (isset($this->source->refs[$refid]['authors']))
					$this->dest->refs[$refid]['authors'] = $this->source->refs[$refid]['authors'];
			} else {
				die("Exists in Dest but not in Source: $refid");
			}
		}

		$this->dest->OutputXML();
	}
}
?>
