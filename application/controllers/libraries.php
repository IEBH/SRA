<?php if ( ! defined('BASEPATH')) exit('No direct script access allowed');
class Libraries extends CI_Controller {
	function __construct() {
		parent::__construct();
		$this->load->model('Library');
	}

	function Index() {
		$this->All();
	}

	function All() {
		$this->site->header('Manage your libraries');
		$this->load->view('lib/batt');
		$this->load->view('libraries/list');
		$this->site->footer();
	}

	function View($libraryid = null) {
		if (!$library = $this->Library->Get($libraryid))
			$this->site->Error('Invalid library');

		$this->site->header($library['title']);
		$this->load->view('lib/batt');
		$this->load->view('libraries/view');
		$this->site->footer();
	}

	function Edit($libraryid = null) {
		$this->site->header('Manage your libraries');
		$this->load->view('lib/batt');
		$this->load->view('libraries/edit');
		$this->site->footer();
	}

	function Import() {
		$this->load->model('Reference');

		if ($_FILES && isset($_FILES['file']['tmp_name'])) {
			$libraryid = $this->Library->Create(array(
				'title' => $_POST['title']
			));

			require('lib/php-endnote/endnote.php');
			$this->endnote = new PHPEndNote();
			$this->endnote->SetXMLFile($_FILES['file']['tmp_name']);
			foreach ($this->endnote->refs as $ref) {
				$this->Reference->Create(array(
					'libraryid' => $libraryid,
					'title' => $ref['title'],
					'authors' => implode(' AND ', $ref['authors']),
					'data' => json_encode($ref),
				));
			}
			$this->site->Redirect("/libraries/view/$libraryid");
		} else { 
			$this->site->Header('Import References');
			$this->load->view('lib/batt');
			$this->site->view('libraries/import');
			$this->site->Footer();
		}
	}

	function Delete($libraryid = null) {
		// Stub
	}
}
