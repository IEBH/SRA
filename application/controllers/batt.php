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
	* @param array $_REQUEST['order'] OPTIONAL array of filters to apply as a WHERE condition (CI compatible)
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
		if (!is_array($_REQUEST['fields']))
			die($this->site->JSONError('Fields must be an array'));

		$this->db->from($_REQUEST['table']);
		$this->db->where('status', 'active'); // FIXME: This shouldn't be implied

		// FIXME: $_REQUEST['filter'] should be merged with the contents of the server side schema files filters
		if (isset($_REQUEST['filter']) && $_REQUEST['filter']) {
			if (!is_array($_REQUEST['filter']))
				die($this->site->JSONError('Filter must be an array'));
			$json['header']['filters'] = $_REQUEST['filter'];
			$this->db->where($_REQUEST['filter']);
		}

		if (isset($_REQUEST['order']) && $_REQUEST['order'])
			$this->db->order_by($_REQUEST['order']);

		$json['header']['sql'] = $this->db->_compile_select();
		foreach ($this->db->get()->result_array() as $data) {
			$row = array();
			if (!isset($data[$_REQUEST['key']])) // If primary key is not present - panic
				$this->site->JSONError('Primary key not returned in data feed');
			$row['_id'] = $data[$_REQUEST['key']];
			foreach ($_REQUEST['fields'] as $col)
				$row[$col] = isset($data[$col]) ? $data[$col] : null;
			$json['payload'][] = $row;
		}

		$this->site->JSON($json);
	}
}
