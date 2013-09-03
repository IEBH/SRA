<?php if ( ! defined('BASEPATH')) exit('No direct script access allowed');
class References extends CI_Controller {
	function __construct() {
		parent::__construct();
		$this->load->model('Reference');
	}

	function Index() {
		$this->All();
	}

	function All() {
		$this->site->Header('References');
		$this->site->view('references/list', array(
			'papers' => $this->Basket->GetAll(),
		));
		$this->site->Footer();
	}

	function Clear() {
		$this->Basket->Clear();
		$this->site->RedirectBack();
	}

	function Edit($referenceid = null) {
		$this->load->model('Library');

		if (!$reference = $this->Reference->Get($referenceid))
			$this->Site->Error('Invalid reference');
		if (!$library = $this->Library->Get($reference['libraryid']))
			$this->Site->Error('Invalid parent library');
		$reference = $this->Reference->Explode($reference);

		$this->site->Header("Reference #$referenceid", array(
			'breadcrumbs' => array(
				'/libraries' => 'My References',
				"/libraries/view/{$library['libraryid']}" => $library['title'],
			),
		));
		$this->site->view('lib/batt');
		$this->site->view('references/edit', array(
			'library' => $library,
			'reference' => $reference,
		));
		$this->site->Footer();
	}

	function Delete($referenceid = null) {
		if (!$reference = $this->Reference->Get($referenceid))
			$this->site->Error('Invalid reference');
		$this->Reference->Save($referenceid, array('status' => 'deleted'));
		$this->site->Redirect("/libraries/view/{$reference['libraryid']}");
	}

	function Export() {
		if (!$references = $this->Basket->GetAll())
			$this->Site->Error('No references to export');

		require('lib/php-endnote/endnote.php');
		$this->endnote = new PHPEndNote();

		foreach ($references as $refno => $ref) {
			$this->endnote->Add(array(
				'author' => $ref['ref'],
				'address' => $ref['contact-name'] . ($ref['contact-email'] ? ' - ' . $ref['contact-email'] : ''),
				'title' => $ref['title'],
				'title-short' => $ref['title-scientific'],
				'date' => $ref['date-reg'],
				'abstract' => $ref['primary-outcomes'],
				'url' => $ref['url-real'],
				'notes' => 'STUDY TYPE' . "\n" . $ref['study-type'] . "\n\nSTUDY DESIGN\n" . $ref['study-design'],
			));
		}
		echo $this->endnote->GetXML();
	}
}
