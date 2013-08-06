<?php if ( ! defined('BASEPATH')) exit('No direct script access allowed');

class Batt extends CI_Controller {
	var $batt_path = 'lib/batt';
	var $batt_load = array(
		'bootstrap' => false,
		'jquery' => false,
		'script' => true,
		'mustache' => true,
	);

	function Show($view = null) {
		$args = func_get_args();
		$view = implode('/', $args);

		$view = preg_replace('/\.(.+)$/', '', $view);

		$matches = glob("application/views/batt/$view.*");
		if (!count($matches)) {
			header('HTTP/1.0 404 Not Found');
			echo "<h1>404 Not Found</h1>";
			echo "The page that you have requested could not be found.";
			exit();
		}

		$ext = pathinfo(current($matches), PATHINFO_EXTENSION);
		
		if (!file_exists("application/views/batt/wrappers/$ext.php"))
			$this->site->Error("No wrapper to handle this file type: $ext");

		if (isset($_GET['noheaders']) && $_GET['noheaders']) {
			$this->load->view("batt/$view");
		} else {
			$this->load->view("batt/wrappers/$ext", array(
				'wrapper' => $ext,
				'view' => $view,
				'batt_path' => $this->batt_path,
				'batt_load' => $this->batt_load,
			));
		}
	}

	/**
	* Request data from the database
	* @param string $_REQUEST['table'] The table to pull data from
	* @param string $_REQUEST['fields'] The fields to retrieve as a CSV
	* @param string $_REQUEST['key'] The field to use as the primary key
	* @param string $_REQUEST['order'] OPTIONAL order by condition
	*/
	function JSONFeed() {
		$json = array(
			'header' => array('status' => 'OK'),
			'payload' => array(),
		);

		if (!isset($_REQUEST['table']))
			die($this->site->JSONError('Table not specified'));
		if (!isset($_REQUEST['key']))
			die($this->site->JSONError('Key not specified'));
		if (!isset($_REQUEST['fields']))
			die($this->site->JSONError('Fields not specified'));
		$_REQUEST['fields'] = preg_split('/\s*,\s*/', $_REQUEST['fields']);

		$this->db->from($_REQUEST['table']);
		$this->db->where('status', 'active'); // FIXME: This shouldn't be implied
		if (isset($_REQUEST['order']) && $_REQUEST['order'])
			$this->db->order_by($_REQUEST['order']);

		foreach ($this->db->get()->result_array() as $data) {
			$row = array();
			if (!isset($data[$_REQUEST['key']])) // If primary key is not present - panic
				$this->site->JSONError('Primary key not returned in data feed');
			$row['_id_'] = $data[$_REQUEST['key']];
			foreach ($_REQUEST['fields'] as $col)
				$row[$col] = isset($col) ? $data[$col] : null;
			$json['payload'][] = $row;
		}

		$this->site->JSON($json);
	}
}
