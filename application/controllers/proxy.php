<?php if ( ! defined('BASEPATH')) exit('No direct script access allowed');
class Proxy extends CI_Controller {
	function __construct() {
		parent::__construct();
		$this->load->model('Curl');
	}

	function Index() {
		$this->site->redirect('/');
	}

	function _EstablishSession() {
		// New Session - WHO {{{
		if (!isset($_SESSION['who_session'])) {
			$session_content = $this->Curl->Fetch('http://apps.who.int/trialsearch/Default.aspx');
			$_SESSION['who_session'] = array();
			preg_match_all('!<input type="hidden" name="(__.*?)" id="\1" value="(.*?)" />!', $session_content, $matches, PREG_SET_ORDER);
			foreach ($matches as $match)
				$_SESSION['who_session'][$match[1]] = $match[2];
		}
		// }}}
		// New Session - Basket {{{
		if (!isset($_SESSION['basket']))
			$_SESSION['basket'] = array();
		// }}}
	}

	function Who() {
		$papers = array();
		$this->_EstablishSession();
		// Send search data {{{
		$post = $_SESSION['who_session'];
		$post['Button1'] = 'Search';
		if (isset($_REQUEST['q']))
			$post['TextBox1'] = $_REQUEST['q'];

		$content = $this->Curl->Fetch('http://apps.who.int/trialsearch/Default.aspx', $post);
		preg_match_all('!<a id=".*?" href="Trial\.aspx\?TrialID=(.*?)" target="_blank">(.*?)</a>!s', $content, $matches, PREG_SET_ORDER);
		foreach ($matches as $match)
			$papers[$match[1]] = array(
				'paperid' => $match[1],
				'source' => 'WHO',
				'url' => "/proxy/whopaper/{$match[1]}",
				'name' => $match[2],
				'in-basket' => isset($_SESSION['basket'][$match[1]]),
			);
		// }}}

		$this->site->Header('WHO search proxy');
		$this->site->view('proxy/results', array(
			'content' => $content,
			'papers' => $papers,
		));
		$this->site->Footer();
	}

	function WhoPaper($ref = null) {
		if (!$ref)
			$this->site->redirect('/');

		// Retrieve paper {{{
		$content = $this->Curl->Fetch("http://apps.who.int/trialsearch/Trial.aspx?TrialID=$ref");
		$paper = array(
			'ref' => $ref,
			'url-who' => "http://apps.who.int/trialsearch/trial.aspx?trialid=$ref",
		);

		preg_match('!Register.*?<span.*?>(.*?)</span>!sm', $content, $matches);
		$paper['register'] = $matches[1];
		preg_match('!Last refreshed on.*?<span.*?>(.*?)</span>!sm', $content, $matches);
		$paper['date-refresh'] = $matches[1];
		preg_match('!Date of registration.*?<span.*?>(.*?)</span>!sm', $content, $matches);
		$paper['date-reg'] = $matches[1];
		preg_match('!Date of first enrolment.*?<span.*?>(.*?)</span>!sm', $content, $matches);
		$paper['date-enrolment'] = $matches[1];
		preg_match('!Primary sponsor.*?<span.*?>(.*?)</span>!sm', $content, $matches);
		$paper['sponsor'] = $matches[1];
		preg_match('!Public title.*?<span.*?>(.*?)</span>!sm', $content, $matches);
		$paper['title-public'] = $matches[1];
		preg_match('!Scientific title.*?<span.*?>(.*?)</span>!sm', $content, $matches);
		$paper['title-scientific'] = $matches[1];
		preg_match('!Target sample size.*?<span.*?>(.*?)</span>!sm', $content, $matches);
		$paper['target-sample-size'] = $matches[1];
		preg_match('!Recruitment status.*?<span.*?>(.*?)</span>!sm', $content, $matches);
		$paper['recruitment-status'] = $matches[1];
		preg_match('!URL.*?<a.*?>(.*?)</a>!sm', $content, $matches);
		$paper['url-real'] = $matches[1];
		preg_match('!Study type.*?<span.*?>(.*?)</span>!sm', $content, $matches);
		$paper['study-type'] = $matches[1];
		// }}}
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

		$this->waveform->Set($paper);
		$this->waveform->Apply('readonly', array_keys($this->waveform->Fields));
		// }}}

		$this->site->Header("WHO paper | $ref");
		$this->site->view('proxy/paper', array(
			'paper' => $paper,
		));
		$this->site->Footer();
	}
}
