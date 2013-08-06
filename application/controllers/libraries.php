<?php if ( ! defined('BASEPATH')) exit('No direct script access allowed');
class Libraries extends CI_Controller {
	function Index() {
		$this->All();
	}

	function All() {
		$this->site->header('Manage your libraries');
		$this->load->view('lib/batt');
		$this->load->view('libraries/list');
		$this->site->footer();
	}

	function Edit($libraryid = null) {
		$this->site->header('Manage your libraries');
		$this->load->view('lib/batt');
		$this->load->view('libraries/edit');
		$this->site->footer();
	}

	function Import($libraryid = null) {
		$this->site->Header('Import References');
		$this->site->view('libraries/import');
		$this->site->Footer();
	}

	function Delete($libraryid = null) {
		// Stub
	}
}
