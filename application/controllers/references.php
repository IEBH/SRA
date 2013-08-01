<?php if ( ! defined('BASEPATH')) exit('No direct script access allowed');
class References extends CI_Controller {
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
		//$this->endnote->OutputXML();
		echo $this->endnote->GetXML();
	}
}
