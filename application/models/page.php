<?
class Page extends CI_Model {
	function GetSteps() {
		return array(
			'How to Ask a question',
			'Finding previous systematic reviews',
			'Write the protocol',
			'Developing the search stratergy',
			'Running searches &amp; de-duplication',
			'Initial screening of titles and abstracts',
			'Finding full-text',
			'Screening full-text',
			'Reference and citation checks',
			'Data extraction from included studies',
			'Meta-analysis',
			'Write up',
		);
	}
}
