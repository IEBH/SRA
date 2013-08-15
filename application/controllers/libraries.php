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
			'breadcrumbs' => array(
				'/libraries' => 'My References'
			),
		));
		$this->load->view('lib/batt');
		$this->load->view('libraries/view', array(
			'library' => $library,
		));
		$this->site->footer();
	}

	function Edit($libraryid = null) {
		if (!$library = $this->Library->Get($libraryid))
			$this->site->Error('Invalid library');
		$this->site->header('Manage your libraries');
		$this->load->view('lib/batt');
		$this->load->view('libraries/edit', array(
			'library' => $library,
		));
		$this->site->footer();
	}

	function Import($libraryid = null) {
		$this->load->model('Reference');

		if ($_FILES && isset($_FILES['file']['tmp_name']) && $_FILES['file']['tmp_name']) {
			$libraryid = $this->Library->Create(array(
				'title' => $_POST['title']
			));

			require('lib/php-endnote/endnote.php');
			$this->endnote = new PHPEndNote();
			$this->endnote->SetXMLFile($_FILES['file']['tmp_name']);

			foreach ($this->endnote->refs as $ref) {
				$json_obj = $ref;
				unset($json_obj['authors'], $json_obj['title']); // Scrap fields are are storing elsewhere anyway

				$this->Reference->Create(array(
					'libraryid' => $libraryid,
					'title' => $ref['title'],
					'authors' => implode(' AND ', $ref['authors']),
					'data' => json_encode($json_obj),
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

	function Export($libraryid = null) {
		$this->load->model('Reference');

		if (!$library = $this->Library->Get($libraryid))
			$this->site->Error('Invalid library');

		require('lib/php-endnote/endnote.php');
		$this->endnote = new PHPEndNote();
		$this->endnote->name = $library['title'] . '.enl';
		foreach ($this->Reference->GetAll(array('libraryid' => $libraryid, 'status' => 'active')) as $ref)
			$this->endnote->Add($this->Reference->Explode($ref));

		$this->endnote->OutputXML($library['title'] . '.xml');	
	}

	function Delete($libraryid = null) {
		// Stub
	}

	/**
	* Start or continue the de-duplication process
	* @param int $libraryid The library to apply the process to
	* @param string $force If the value is 'force' and the library.status='deduped' the process will be force-restarted again
	*/
	function Dedupe($libraryid = null, $force = null) {
		$this->load->model('Reference');

		if (!$library = $this->Library->Get($libraryid))
			$this->site->Error('Invalid library');

		$this->site->header("De-duplicate", array(
			'breadcrumbs' => array(
				'/libraries' => 'My References',
				"/libraries/view/$libraryid" => $library['title'],
			),
		));

		switch ($force=='force' ? 'active' : $library['status']) {
			case 'active': // Start the dedupe
				$this->Library->SaveDupeStatus($library['libraryid'], 0, 0);
				$this->Library->SetStatus($library['libraryid'], 'dedupe');
				$this->load->view('libraries/dedupe/processing', array(
					'library' => $library,
				));
				break;
			case 'dedupe': // During / continuing a dedupe
				$this->load->view('libraries/dedupe/processing', array(
					'library' => $library,
				));
				break;
			case 'deduped': // Post dedupe - review
				$this->load->view('libraries/dedupe/review', array(
					'library' => $library,
					'dupes' => $this->Reference->GetAll(array('altdata !=' => '')),
				));
				break;
			default:
				$this->site->Error("Unable to process duplications when library is in the state '{$library['state']}'");
		}
		
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
				die($this->site->JSONError("Missing parameter: $key"));

		if (!$library = $this->Library->Get($_REQUEST['libraryid']))
			die($this->site->JSONError('Invalid library'));
		if ($library['status'] != 'dedupe')
			die($this->site->JSONError('Not in De-dupe mode'));

		$end = time() + DEDUPE_MAX_TIME;
		set_time_limit(DEDUPE_MAX_TIME*2); // Bias PHPs own time limit by a good margin (time to respond with the JSON)

		$refoffset = $refoffset2 = 0;
		while ($refs = $this->Reference->GetAll(array('libraryid' => $library['libraryid'], 'referenceid >' => max(0, $library['dedupe_refid']), 'status' => 'active'), DEDUPE_ORDERBY, DEDUPE_SCOOP_REFERENCES)) {
			foreach ($refs as $ref) {
				while ($refs2 = $this->Reference->GetAll(array('libraryid' => $library['libraryid'], 'referenceid >' => max(0, $ref['referenceid'], $library['dedupe_refid2']), 'status' => 'active'), DEDUPE_ORDERBY, DEDUPE_SCOOP_REFERENCES2)) {
					foreach ($refs2 as $ref2) {
						// echo "SCAN {$ref['referenceid']} == {$ref2['referenceid']}<br/>";
						$this->Reference->Compare($ref, $ref2);
					}
					$library['dedupe_refid2'] = $ref2['referenceid'];
					$this->Library->SaveDupeStatus($library['libraryid'], $library['dedupe_refid'], $library['dedupe_refid2']);
					if (time() >= $end)
						break 2;
				}
				$library['dedupe_refid'] = $ref['referenceid'];
				$library['dedupe_refid2'] = 0;
			}
			$this->Library->SaveDupeStatus($library['libraryid'], $library['dedupe_refid'], $library['dedupe_refid2']);
			if (time() >= $end)
				break;
		}

		$done = $library['dedupe_refid'] ? $this->Reference->Count(array('referenceid <=' => $library['dedupe_refid'])) + 1 : 0;
		$total = $this->Reference->Count(array('libraryid' => $library['libraryid']));
		if ($done >= $total)
			$this->Library->SetStatus($library['libraryid'], 'deduped');

		$this->site->JSON(array(
			'header' => array(
				'status' => 'ok',
			),
			'payload' => array(
				'done' => $done,
				'total' => $total,
			),
		));
	}
}
