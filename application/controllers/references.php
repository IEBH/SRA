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

			echo '<contributors><authors><author><style face="normal" font="default" size="100%">' . $ref['ref'] . '</style></author></authors></contributors>';
			echo '<auth-address><style face="normal" font="default" size="100%">FIXME: CONTACT_NAME + CONTACT_EMAIL</style></auth-address>';
			echo '<titles>';
				echo '<title><style face="normal" font="default" size="100%">' . $ref['title'] . '</style></title>';
				echo '<secondary-title><style face="normal" font="default" size="100%">' . '</style></secondary-title>';
				echo '<short-title><style face="normal" font="default" size="100%">' . $ref['title-scientific'] . '</style></short-title>';
			echo '</titles>';

			echo '<periodical><full-title><style face="normal" font="default" size="100%">' . '</style></full-title></periodical>';
			echo '<pages><style face="normal" font="default" size="100%">' . '</style></pages>';
			echo '<volume><style face="normal" font="default" size="100%">' . '</style></volume>';
			echo '<number><style face="normal" font="default" size="100%">' . '</style></number>';
			echo '<section><style face="normal" font="default" size="100%">' . '</style></section>';
			echo '<dates>'
				echo '<year><style face="normal" font="default" size="100%">' . '</style></year>';
				echo '<pub-dates><date><style face="normal" font="default" size="100%">' . $ref['date-ref'] . '</style></date></pub-dates>';
			echo '</dates>';
			echo '<abstract><style face="normal" font="default" size="100%">FIXME: PRIMARY_OUTCOMES</style></abstract>';
			echo '<urls><related-urls><url><style face="normal" font="default" size="100%">' . $ref['url-real'] . '</style></url></related-urls></urls>';
			echo '<research-notes><style face="normal" font="default" size="100%">FIXME: STUDY_TYPE + STUDY_DESIGN</style></research-notes>';

			echo '</record>';
		}
		echo '</records></xml>';
	}
}
