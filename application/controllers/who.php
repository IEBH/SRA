<?php if ( ! defined('BASEPATH')) exit('No direct script access allowed');
class Who extends CI_Controller {
	function __construct() {
		parent::__construct();
		$this->load->model('Searchwho');
		$this->load->model('Basket');
	}

	function Index() {
		$this->site->Redirect('/search');
	}

	function Paper($ref = null) {
		$args = func_get_args();
		$ref = implode('/', $args);
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

		if (preg_match('/(search\?q=.*)$/', $_SERVER['HTTP_REFERER'], $matches)) {
			$breadcrumbs = array(SITE_ROOT . $matches[1] => 'Search');
		} else {
			$breadcrumbs = array('/search' => 'Search');
		}

		$this->site->Header($ref, array('breadcrumbs' => $breadcrumbs));
		$this->site->view('who/paper', array(
			'paper' => $paper,
		));
		$this->site->Footer();
	}

	function Add($ref = null) {
		$this->load->model('Library');
		$this->load->model('Reference');

		$args = func_get_args();
		$ref = implode('/', $args);
		if (!$ref)
			$this->site->redirect('/');
		if (!$paper = $this->Searchwho->Get($ref))
			$this->Site->Error("Cannot find paper with reference $ref");

		$basket = $this->Library->GetBasket(TRUE);
		$data = $paper;
		// Translate WHO -> EndNote {{{
		unset($data['title']);
		$data['date'] = $data['date-reg'];
		// }}}
		$this->Reference->Create(array(
			'libraryid' => $basket['libraryid'],
			'title' => $paper['title'],
			'authors' => $paper['contact-name'],
			'data' => $data,
			'yourref' => 'who-' . $paper['ref'],
		));

		$this->site->RedirectBack('/search');
	}
}
