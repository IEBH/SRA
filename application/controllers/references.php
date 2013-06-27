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

		header('Content-type: text/plain');
		header('Content-Disposition: attachment; filename="CREB-SearchTool.xml"');
		echo '<?xml version="1.0" encoding="UTF-8"?><xml><records>';
		foreach ($references as $refno => $ref) {
			echo '<record>';
			echo '<database name="CREBP-SearchTool.enl" path="C:\CREBP-SearchTool.enl">CREBP-SearchTool.enl</database>';
			echo '<source-app name="EndNote" version="16.0">EndNote</source-app>';
			echo '<rec-number>' . $refno . '</rec-number>';
			echo '<foreign-keys><key app="EN" db-id="s55prpsswfsepue0xz25pxai2p909xtzszzv">' . $refno . '</key></foreign-keys>';
			echo '<ref-type name="Journal Article">17</ref-type>';

			// FIXME: Wrong
			echo '<contributors><authors><author><style face="normal" font="default" size="100%">FAKE AUTHOR</style></author></authors></contributors>';
			echo '<titles>';
			echo '<title><style face="normal" font="default" size="100%">' . $ref['title'] . '</style></title>';
			echo '<secondary-title><style face="normal" font="default" size="100%">FAKE JOURNAL</style></secondary-title>';
			echo '</titles>';
			echo '<periodical><full-title><style face="normal" font="default" size="100%">FAKE JOURNAL</style></full-title></periodical>';
			echo '<pages><style face="normal" font="default" size="100%">FAKE PAGES</style></pages>';
			echo '<volume><style face="normal" font="default" size="100%">FAKE VOLUME</style></volume>';
			echo '<number><style face="normal" font="default" size="100%">FAKE ISSUE</style></number>';
			echo '<section><style face="normal" font="default" size="100%">FAKE StartPage</style></section>';
			echo '<dates><year><style face="normal" font="default" size="100%">FAKE YEAR</style></year></dates>';
			echo '<urls/>';

			echo '</record>';
		}
		echo '</records></xml>';
	}
}
