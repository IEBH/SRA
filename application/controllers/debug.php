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
}
?>
