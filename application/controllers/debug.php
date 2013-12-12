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
		$this->endnote->SetXMLFile('data/A057 - Post SRA Friday 27-11-2013.xml');
		foreach ($this->endnote->refs as $refno => $ref) {
			if (isset($myrefs[$ref['caption']]))
				$ref['language'] = $ref['label'];
			$this->endnote->refs[$refno] = $ref; // Save back
		}
		$this->endnote->OutputXML();
	}
}
?>
