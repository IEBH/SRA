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

		$this->site->header($library['title'], array(
			'breadcrumbs' => array('/libraries' => 'My References'),
		));
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

		if ($_FILES && isset($_FILES['file']['tmp_name']) && $_FILES['file']['tmp_name']) {
			$libraryid = $this->Library->Create(array(
				'title' => $_POST['title']
			));

			require('lib/php-endnote/endnote.php');
			$this->endnote = new PHPEndNote();
			$this->endnote->SetXMLFile($_FILES['file']['tmp_name']);

			$json = json_encode($ref);
			unset($json['authors']); // Scrap fields are are storing elsewhere anyway
			unset($json['title']);

			foreach ($this->endnote->refs as $ref) {
				$this->Reference->Create(array(
					'libraryid' => $libraryid,
					'title' => $ref['title'],
					'authors' => implode(' AND ', $ref['authors']),
					'data' => $json,
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

	function Dupes($libraryid = null) {
		if (!$library = $this->Library->Get($libraryid))
			$this->site->Error('Invalid library');
		
		$this->site->header("{$library['title']} | De-duplicate");
		$this->load->view('libraries/dupes');
		$this->site->footer();
	}

	/**
	* API worker for Dupes()
	* @param int $_REQUEST['libraryid'] The library ID to work on
	* @see Dupes()
	*/
	function JSONDupes() {
		$this->load->model('Reference');

		foreach (qw('libraryid') as $key)
			if (!isset($_REQUEST[$key]))
				$this->site->JSONError("Missing parameter: $key");

		if (!$library = $this->Library->Get($_REQUEST['libraryid']))
			die($this->site->JSONError('Invalid library'));

		if ($library['status'] != 'dedupe') { // Not been de-duped before
			$this->Library->SetStatus($library['libraryid'], 'dedupe');
			$library['dedupe_refid'] = 0;
			$library['dedupe_refid2'] = 0;
		}

		$end = time() + DEDUPE_MAX_TIME;
		set_time_limit(DEDUPE_MAX_TIME*2); // Bias PHPs own time limit by a good margin (time to respond with the JSON)

		$refoffset = $refoffset2 = 0;
		while ($refs = $this->Reference->GetAll(array('libraryid' => $library['libraryid'], 'referenceid >' => $library['dedupe_refid'], 'status' => 'active'), DEDUPE_ORDERBY, DEDUPE_SCOOP_REFERENCES)) {
			echo "BEGIN LOOP 1 > {$library['dedupe_refid']}<br/>";
			foreach ($refs as $ref) {
				echo "SCAN 1 {$ref['referenceid']}<br/>";
				while ($refs2 = $this->Reference->GetAll(array('libraryid' => $library['libraryid'], 'referenceid >' => max($ref['referenceid'], $library['dedupe_refid2']), 'status' => 'active'), DEDUPE_ORDERBY, DEDUPE_SCOOP_REFERENCES2)) {
					echo "BEGIN LOOP 2<br/>";
					foreach ($refs2 as $ref2) {
						echo "SCAN {$ref['referenceid']} == {$ref2['referenceid']}<br/>";
						$this->Reference->Compare($ref, $ref2);
					}
					$library['dedupe_refid2'] = $ref2['referenceid'];
					$this->Library->SaveDupeStatus($library['libraryid'], $library['dedupe_refid'], $library['dedupe_refid2']);
					if (time() >= $end)
						break 2;
					echo "LOOP 2<br/>";
				}
				$library['dedupe_refid'] = $ref['referenceid'];
				$library['dedupe_refid2'] = 0;
			}
			$this->Library->SaveDupeStatus($library['libraryid'], $library['dedupe_refid'], $library['dedupe_refid2']);
			if (time() >= $end)
				break;
			echo "LOOP 1<br/>";
		}

		$json = array(
			'header' => array(
				'status' => 'ok',
			),
			'payload' => array(),
		);
		foreach ($this->Reference->GetDupes() as $dupe)
			$json['payload'][] = $dupe;
	}
}
