<?php if ( ! defined('BASEPATH')) exit('No direct script access allowed');
class Libraries extends CI_Controller {
	function __construct() {
		parent::__construct();
		$this->load->model('Library');
		$this->Security->EnsureLogin();
	}

	function Index() {
		$this->All();
	}

	function All() {
		$this->site->header('Manage your libraries');
		$this->load->view('libraries/list', array(
			'libraries' => $this->Library->GetAll(array('userid' => $this->User->GetActive('userid'), 'status !=' => 'deleted')),
		));
		$this->site->footer();
	}

	function View($libraryid = null) {
		if (!$library = $this->Library->Get($libraryid))
			$this->site->Error('Invalid library');
		if (!$this->Library->CanEdit($library))
			$this->site->Error('You do not have access to this library');

		$this->site->header($library['title'], array(
			'breadcrumbs' => array(
				'/libraries' => 'Libraries'
			),
		));
		$this->load->view('libraries/view', array(
			'library' => $library,
			'references' => $this->Reference->GetAll(array('libraryid' => $library['libraryid'], 'status !=' => 'deleted')),
			'tags' => $this->Library->GetAllTags($library['libraryid']),
		));
		$this->site->footer();
	}

	function Edit($libraryid = null) {
		if (!$library = $this->Library->Get($libraryid))
			$this->site->Error('Invalid library');
		if (!$this->Library->CanEdit($library))
			$this->site->Error('You do not have access to this library');

		$this->site->header("Edit {$library['title']}", array(
			'breadcrumbs' => array(
				'/libraries' => 'Libraries'
			),
		));
		$this->load->view('libraries/edit', array(
			'library' => $library,
		));
		$this->site->footer();
	}

	function Share($libraryid = null) {
		$this->load->model('Email');
		$this->load->model('Reference');
		$this->load->model('Urlpayload');
		if (!$library = $this->Library->Get($libraryid))
			$this->site->Error('Invalid library');
		if (!$this->Library->CanEdit($library))
			$this->site->Error('You do not have access to this library');

		// Waveform config {{{
		$this->load->spark('waveform/1.0.0');
		
		$this->waveform->Define('email')
			->Title('Email address')
			->Email()
			->Style('class', 'input-block-level');
		// }}}

		if ($this->waveform->OK()) {
			$this->Email->SendEmail('libraries/share', $this->waveform->Fields['email'], array(
				'library.name' => $library['title'],
				'library.references' => $this->Reference->Count(array('libraryid' => $library['libraryid'])),
				'share.url' => $this->Urlpayload->Create(array(
					'command' => 'share',
					'payloadid' => $library['libraryid'],
					'expiry' => strtotime('+3 days'),
				)),
			));
			$this->site->header("Share {$library['title']}", array(
				'breadcrumbs' => array(
					'/libraries' => 'Libraries'
				),
			));
			$this->load->view('libraries/share/complete', array(
				'library' => $library,
				'email' => $fields['email'],
			));
			$this->site->footer();
		} else { 
			$this->site->header("Share {$library['title']}", array(
				'breadcrumbs' => array(
					'/libraries' => 'Libraries'
				),
			));
			$this->load->view('libraries/share/index', array(
				'library' => $library,
			));
			$this->site->footer();
		}
	}

	function Screen($libraryid = null, $method = null, $page = 1) {
		$library = null;
		if ($libraryid) { // Specifying a specific library to use
			if (!$library = $this->Library->Get($libraryid))
				$this->site->Error('Invalid library');
			if (!$this->Library->CanEdit($library))
				$this->site->Error('You do not have access to this library');
		}

		if ($method) { // We are actually screening
			$this->config->load('pagination', TRUE);
			$total = $this->Reference->Count(array('libraryid' => $library['libraryid'], 'status !=' => 'deleted'));
			$this->load->library('pagination', array_merge($this->config->item('pagination'), array(
				'base_url' => SITE_ROOT . "libraries/screen/{$library['libraryid']}/$method",
				'total_rows' => $total,
				'per_page' => SCREEN_LIMIT,
				'uri_segment' => 5,
			)));
			$this->site->header("Screening", array(
				'breadcrumbs' => array(
					'/libraries' => 'Libraries',
					"/libraries/view/{$library['libraryid']}" => $library['title'],
				),
			));
			$this->load->view('libraries/screen/screen', array(
				'library' => $library,
				'total' => $total,
				'references' => $this->Reference->GetAll(array('libraryid' => $library['libraryid'], 'status !=' => 'deleted'), 'referenceid', SCREEN_LIMIT, SCREEN_LIMIT * $page),
				'tags' => $this->Library->GetAllTags($library['libraryid']),
			));
			$this->site->footer();
			return;
		}
		// If we fell though to here we dont have enough information to screen

		// Waveform config {{{
		$this->load->spark('waveform/1.0.0');
		
		$this->waveform->Define('libraryid')
			->Title('Reference library')
			->Choice($this->Library->GetAll(array('userid' => $this->User->GetActive('userid'), 'status !=' => 'deleted')), 'libraryid', 'title')
			->Default($library ? $library : null);

		$this->waveform->Define('method')
			->Title('Screening method')
			->Choice(array(
				'title' => 'Title only',
				'title+authors' => 'Title + authors',
				'title+authors+abstract' => 'Title, authors + abstract',
			))
			->Default('title+authors');

		$this->waveform->Define('tags')
			->Title('Tags to provide')
			->Text()
			->Style('data-tip', 'Seperate tags with commas')
			->Style('data-tip-placement', 'right')
			->Default('Full text, Background, Exclude');
		// }}}

		if ($this->waveform->OK()) {
			if (!$library = $this->Library->Get($this->waveform->Fields['libraryid']))
				$this->site->Error('Invalid library');
			if (!$this->Library->CanEdit($library))
				$this->site->Error('You do not have access to this library');
			foreach (preg_split('/\s*,\s*/', $this->waveform->Fields['tags']) as $tag)
				$this->Library->CreateTag($library['libraryid'], array('title' => $tag));

			$this->site->Redirect("/libraries/screen/{$library['libraryid']}/{$this->waveform->Fields['method']}");
		} else { 
			$this->site->header("Screen {$library['title']}", array(
				'breadcrumbs' => array(
					'/libraries' => 'Libraries'
				),
			));
			$this->load->view('libraries/screen/index', array(
				'library' => $library,
			));
			$this->site->footer();
		}
	}

	/**
	* Import an EndNoteXML file
	* @param bool $_REQUEST['debug'] If set the libraries.debug flag is set and all imported references have their .caption property set to the record number
	*/
	function Import($libraryid = null) {
		$this->load->model('Reference');

		// Waveform config {{{
		$this->load->spark('waveform/1.0.0');
		
		$this->waveform->Group('Import an EndNote file');
		$this->waveform->Define('where')
			->Choice(array(
				'new' => 'New library',
				'existing' => 'Existing library',
			));

		$this->waveform->Define('name_new')
			->Title('Name of new library')
			->Default('Imported Library')
			->NotRequired();

		$this->waveform->Define('existing_id')
			->Choice($this->Library->GetAll(array('userid' => $this->User->GetActive('userid'), 'status !=' => 'deleted')), 'libraryid', 'title')
			->NotRequired();

		$this->waveform->Define('advanced')
			->Title('Advanced options')
			->Checkbox();

		$this->waveform->Define('auto_dedupe')
			->Checkbox();

		$this->waveform->Define('debug')
			->Checkbox();
				
		$this->waveform->Define('file')
			->File();
		// }}}

		if ($fields = $this->waveform->ok()) {
			if (!$_FILES)
				$this->site->Error('No files uploaded');

			if ($this->waveform->Fields['where'] == 'existing') {
				if (!$library = $this->Library->Get($this->waveform->Fields['existing_id']))
					$this->site->Error("Invalid library to import into");
				if (!$this->Library->CanEdit($library))
					$this->site->Error("This library cannot be edited, it may have been deleted or you may not have access to it");
				$libraryid = $library['libraryid'];
			} else { // Create new library and import into that
				$libraryid = $this->Library->Create(array(
					'title' => $this->waveform->Fields['new_name'],
					'debug' => $fields['debug'] ? 'active' : 'inactive',
				));
			}

			require('lib/php-endnote/endnote.php');
			$this->endnote = new PHPEndNote();

			foreach ($_FILES as $file) {
				if (!$file['tmp_name'] || !file_exists($file['tmp_name']))
					continue;
				$this->endnote->SetXMLFile($file['tmp_name']);

				foreach ($this->endnote->refs as $refno => $ref) {
					$json_obj = $ref;
					unset($json_obj['authors'], $json_obj['title'], $json_obj['label']); // Scrap fields are are storing elsewhere anyway

					if ($fields['debug'])
						$json_obj['caption'] = $refno+1;

					$this->Reference->Create(array(
						'libraryid' => $libraryid,
						'title' => $ref['title'],
						'authors' => implode(' AND ', $ref['authors']),
						'label' => $ref['label'],
						'data' => json_encode($json_obj),
					));
				}
			}

			if ($fields['auto_dedupe']) {
				$this->site->Redirect("/libraries/dedupe/$libraryid");
			} else
				$this->site->Redirect("/libraries/view/$libraryid");
		} else { 
			$this->site->Header('Import References', array(
				'breadcrumbs' => array(
					'/libraries' => 'Libraries'
				),
			));
			$this->site->view('libraries/import', array(
				'newName' => 'Imported Library',
			));
			$this->site->Footer();
		}
	}

	function Export($libraryid = null) {
		$this->load->model('Reference');

		if (!$library = $this->Library->Get($libraryid))
			$this->site->Error('Invalid library');
		if (!$this->Library->CanEdit($library))
			$this->site->Error('You do not have access to this library');

		$where = array('libraryid' => $libraryid);
		if ($library['debug'] == 'inactive')
			$where['status'] = 'active';

		require('lib/php-endnote/endnote.php');
		$this->endnote = new PHPEndNote();
		$this->endnote->name = $library['title'] . '.enl';
		foreach ($this->Reference->GetAll($where) as $ref) {
			$full = $this->Reference->Explode($ref);
			$full['authors'] = explode(' AND ', $full['authors']);

			if ($library['debug'] == 'active') {
				switch ($ref['status']) {
					case 'active':
						$full['language'] = 'OK';
						break;
					case 'dupe':
						$full['language'] = 'DUPE';
						break;
					case 'deleted':
						$full['language'] = 'DELETED';
						break;
				}
			}

			$this->endnote->Add($full);
		}

		$this->endnote->OutputXML($library['title'] . '.xml');	
	}

	function Delete($libraryid = null) {
		if (!$libraryid)
			$this->site->redirect('/');
		if (!$library = $this->Library->Get($libraryid))
			$this->site->Error('Invalid library');
		if (!$this->Library->CanEdit($library))
			$this->site->Error('You do not have access to this library');
		$this->Library->SetStatus($libraryid, 'deleted');
		$this->site->Redirect("/libraries");
	}

	/**
	* Start or continue the de-duplication process
	* @param int $libraryid The library to apply the process to
	* @param string $force If the value is 'force' and the library.status='deduped' the process will be force-restarted again
	*/
	function Dedupe($libraryid = null, $force = null) {
		$this->load->model('Reference');

		if (!$library = $this->Library->Get($libraryid))
			$this->site->Error('Invalid library');
		if (!$this->Library->CanEdit($library))
			$this->site->Error('You do not have access to this library');

		$this->site->header("De-duplicate", array(
			'breadcrumbs' => array(
				'/libraries' => 'Libraries',
				"/libraries/view/$libraryid" => $library['title'],
			),
		));

		switch ($force=='force' ? 'active' : $library['status']) {
			case 'active': // Start the dedupe
				$this->Library->ResetDupeStatus($library['libraryid']);
				$this->load->view('libraries/dedupe/processing', array(
					'library' => $library,
				));
				break;
			case 'dedupe': // During / continuing a dedupe
				$this->load->view('libraries/dedupe/processing', array(
					'library' => $library,
				));
				break;
			case 'deduped': // Post dedupe - review
				$this->load->view('libraries/dedupe/review', array(
					'library' => $library,
					'dupes' => $this->Reference->GetAll(array('altdata !=' => '')),
				));
				break;
			default:
				$this->site->Error("Unable to process duplications when library is in the state '{$library['state']}'");
		}
		
		$this->site->footer();
	}

	/**
	* Called to finish the deupe process and reset the status of the library
	*/
	function Finish($libraryid = null) {
		if (!$libraryid)
			$this->site->redirect('/');
		if (!$library = $this->Library->Get($libraryid))
			$this->site->Error('Invalid library');
		if (!$this->Library->CanEdit($library))
			$this->site->Error('You do not have access to this library');

		$this->Library->SetStatus($libraryid, 'active');
		$this->site->Redirect("/libraries/view/$libraryid");
	}

	function Clear($libraryid = null) {
		if (!$libraryid)
			$this->site->redirect('/');
		if (!$library = $this->Library->Get($libraryid))
			$this->site->Error('Invalid library');
		if (!$this->Library->CanEdit($library))
			$this->site->Error('You do not have access to this library');
		$this->Library->Clear($libraryid);
		$this->site->Redirect("/libraries/view/$libraryid");
	}

	/**
	* Perform an action on the left/right side duplication
	* @param string $_REQUEST['action'] The action to perform
	* @param string $_REQUEST['left'] The left side reference ID to operate on
	*/
	function JSONDupeAction() {
		$this->load->model('Reference');

		foreach (qw('action left') as $key)
			if (!isset($_REQUEST[$key]))
				die($this->site->JSONError("Missing parameter: $key"));

		switch ($_REQUEST['action']) {
			case 'save': // Accept left, delete right, merge
				die($this->site->JSONError("Not yet supported"));
				break;
			case 'delete': // Delete both left/right sides
				if (!isset($_REQUEST['right']))
					die($this->site->JSONError("Missing parameter: right"));
				if (!$left = $this->Reference->Get($_REQUEST['left']))
					die($this->site->JSONError("Invalid left reference"));
				if (!$right = $this->Reference->Get($_REQUEST['right']))
					die($this->site->JSONError("Invalid right reference"));

				// Set both as active
				$this->Reference->SetStatus($left['referenceid'], 'deleted');
				$this->Reference->SetStatus($right['referenceid'], 'deleted');
				break;
			case 'break': // left/right is not a dupe
				if (!isset($_REQUEST['right']))
					die($this->site->JSONError("Missing parameter: right"));
				if (!$left = $this->Reference->Get($_REQUEST['left']))
					die($this->site->JSONError("Invalid left reference"));
				if (!$right = $this->Reference->Get($_REQUEST['right']))
					die($this->site->JSONError("Invalid right reference"));

				// Set both as active
				$this->Reference->SetStatus($left['referenceid'], 'active');
				$this->Reference->SetStatus($right['referenceid'], 'active');

				// Remove alternative data
				$this->Reference->Save($left['referenceid'], array('altdata' => ''));

				break;
			default:
				die($this->site->JSONError("Invalid action: {$_REQUEST['action']}"));
		}

		$this->site->JSON(array(
			'header' => array(
				'status' => 'ok',
			),
		));
	}

	/**
	* API worker for Dupes()
	* @param int $_REQUEST['libraryid'] The library ID to work on
	* @see Dupes()
	*/
	function JSONDupes() {
		$this->load->model('Reference');

		foreach (qw('libraryid') as $key)
			if (!isset($_REQUEST[$key]))
				die($this->site->JSONError("Missing parameter: $key"));

		if (!$library = $this->Library->Get($_REQUEST['libraryid']))
			die($this->site->JSONError('Invalid library'));
		if ($library['status'] != 'dedupe')
			die($this->site->JSONError('Not in De-dupe mode'));

		$end = time() + DEDUPE_MAX_TIME;
		set_time_limit(DEDUPE_MAX_TIME*2); // Bias PHPs own time limit by a good margin (time to respond with the JSON)

		$refoffset = $refoffset2 = 0;
		while ($refs = $this->Reference->GetAll(array('libraryid' => $library['libraryid'], 'referenceid >' => max(0, $library['dedupe_refid']), 'status' => 'active'), DEDUPE_ORDERBY, DEDUPE_SCOOP_REFERENCES)) {
			foreach ($refs as $ref) {
				while ($refs2 = $this->Reference->GetAll(array('libraryid' => $library['libraryid'], 'referenceid >' => max(0, $ref['referenceid'], $library['dedupe_refid2']), 'status' => 'active'), DEDUPE_ORDERBY, DEDUPE_SCOOP_REFERENCES2)) {
					foreach ($refs2 as $ref2) {
						// echo "SCAN {$ref['referenceid']} == {$ref2['referenceid']}<br/>";
						$this->Reference->Compare($ref, $ref2);
					}
					$library['dedupe_refid2'] = $ref2['referenceid'];
					$this->Library->SaveDupeStatus($library['libraryid'], $library['dedupe_refid'], $library['dedupe_refid2']);
					if (time() >= $end)
						break 2;
				}
				$library['dedupe_refid'] = $ref['referenceid'];
				$library['dedupe_refid2'] = 0;
			}
			$this->Library->SaveDupeStatus($library['libraryid'], $library['dedupe_refid'], $library['dedupe_refid2']);
			if (time() >= $end)
				break;
		}

		$done = $library['dedupe_refid'] ? $this->Reference->Count(array('referenceid <=' => $library['dedupe_refid'])) + 1 : 0;
		$total = $this->Reference->Count(array('libraryid' => $library['libraryid']));
		if ($done >= $total)
			$this->Library->SetStatus($library['libraryid'], 'deduped');

		$this->site->JSON(array(
			'header' => array(
				'status' => 'ok',
			),
			'payload' => array(
				'done' => $done,
				'total' => $total,
				'dupes' => $this->Reference->Count(array('libraryid' => $library['libraryid'], 'status' => 'dupe')),
			),
		));
	}

	/**
	* API for setting the reference tag of an item
	* @param int $_REQUEST['referenceid'] The reference ID to work on
	* @param int $_REQUEST['tagid'] The ID of the tag to set
	*/
	function JSONSetTag() {
		$this->load->model('Reference');

		foreach (qw('referenceid tagid') as $key)
			if (!isset($_REQUEST[$key]))
				die($this->site->JSONError("Missing parameter: $key"));

		if (!$reference = $this->Reference->Get($_REQUEST['referenceid']))
			$this->site->JSONError('Invalid reference');
		if (!$library = $this->Library->Get($reference['libraryid']))
			$this->site->JSONError('Invalid library');
		if (!$this->Library->CanEdit($library))
			$this->site->JSONError('You do not have access to this library');
		$this->Reference->Save($reference['referenceid'], array(
			'referencetagid' => $_REQUEST['tagid'],
		));

		$tags = array(
			0 => $this->Reference->Count(array('libraryid' => $library['libraryid'], 'status !=' => 'deleted')),
		);

		foreach ($this->Library->GetAllTags($library['libraryid']) as $tag)
			$tags[$tag['referencetagid']] = $this->Reference->Count(array('libraryid' => $library['libraryid'], 'status !=' => 'deleted', 'referencetagid' => $tag['referencetagid']));

		$this->site->JSON(array(
			'header' => array(
				'status' => 'ok',
			),
			'tags' => $tags,
		));
	}
}
