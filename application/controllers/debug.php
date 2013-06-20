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
}
?>
