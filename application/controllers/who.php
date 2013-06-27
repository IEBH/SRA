<?php if ( ! defined('BASEPATH')) exit('No direct script access allowed');
class Who extends CI_Controller {
	function __construct() {
		parent::__construct();
		$this->load->model('Searchwho');
		$this->load->model('Basket');
	}

	function Index() {
		$this->Search();
	}

	function Search() {
		if (!isset($_REQUEST['q']))
			$this->site->Redirect('/');

		$this->site->Header('WHO Search');
		$this->site->view('who/search', array(
			'papers' => $this->Searchwho->GetAll($_REQUEST['q']),
		));
		$this->site->Footer();
	}

	function Paper($ref = null) {
		$ref = implode('/', func_get_args());
		if (!$ref)
			$this->site->redirect('/');
		if (!$paper = $this->Searchwho->Get($ref))
			$this->Site->Error("Cannot find paper with reference $ref");
		// Waveform config {{{
		$this->load->spark('waveform/1.0.0');

		$this->waveform->Define('title-public')
			->Title('Public Title');
		$this->waveform->Define('title-scientific')
			->Title('Scientific Title');
		$this->waveform->Define('url-who')
			->Title('URL (WHO site)');
		$this->waveform->Define('url-real')
			->Title('URL');
		$this->waveform->Define('contact-name')
			->Title('Contact Name');
		$this->waveform->Define('contact-email')
			->Title('Contact Email');
		$this->waveform->Define('register');
		$this->waveform->Define('date-refresh')
			->Title('Last refreshed on');
		$this->waveform->Define('date-reg')
			->Title('Date of registration');
		$this->waveform->Define('date-enrolment')
			->Title('Date of first enrolment');
		$this->waveform->Define('sponsor')
			->Title('Primary Sponsor');
		$this->waveform->Define('target-size')
			->Title('Target sample size');
		$this->waveform->Define('recruitment-status')
			->Title('Recruitment status');
		$this->waveform->Define('study-type')
			->Title('Study type');
		$this->waveform->Define('study-design')
			->Title('Study design');
		$this->waveform->Define('primary-outcomes')
			->Title('Primary Outcomes');

		$this->waveform->Set($paper);
		$this->waveform->Apply('readonly');
		$this->waveform->Apply('link', 'url-who, url-real');
		// }}}

		$this->site->Header("WHO Paper | $ref");
		$this->site->view('who/paper', array(
			'paper' => $paper,
		));
		$this->site->Footer();
	}

	function Add($ref = null) {
		$ref = implode('/', func_get_args());
		if (!$ref)
			$this->site->redirect('/');
		if (!$paper = $this->Searchwho->Get($ref))
			$this->Site->Error("Cannot find paper with reference $ref");
		$this->Basket->Add("who-$ref", $paper);
		$this->site->RedirectBack('/references');
	}

	function Remove($ref = null) {
		$ref = implode('/', func_get_args());
		$this->Basket->Remove($ref);
		$this->site->RedirectBack('/references');
	}
}
