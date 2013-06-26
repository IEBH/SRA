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
}
