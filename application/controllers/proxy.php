<?php if ( ! defined('BASEPATH')) exit('No direct script access allowed');
class Proxy extends CI_Controller {
	function __construct() {
		parent::__construct();
		$this->load->model('Curl');
	}

	function Index() {
		$this->site->redirect('/');
	}

	function Who() {
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
		$papers = array();
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
				'url' => "/proxy/who-paper/{$match[1]}",
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
}
