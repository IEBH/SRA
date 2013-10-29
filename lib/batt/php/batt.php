<?php
/**
* Batt form library and validator class
*
* @package Batt
* @author "Matt Carter" <m@ttcarter.com>
*/

class Batt {
	function Headers() {
		$batt_load = array(
			'bootstrap' => false,
			'jquery' => false,
			'script' => true,
			'mustache' => true,
		);
		$batt_root = SITE_ROOT;
		require('lib/batt/src/batt_debug.php');
	}

	function Done() {
		if ($_POST)
			return $_POST;
		return false;
	}

	function Read($file) {
		ob_start();
		require($file);
		$contents = ob_get_contents();
		ob_end_clean();

		$batts = array();
		if (preg_match_all('/<script.+?type=("|\')batt\1.*?>(.*?)<\/script>/ims', $contents, $matches, PREG_SET_ORDER)) {
			foreach ($matches as $match) {
				// $batts[] = $match[2];
				$batts[] = $this->json_decode($match[2]);
			}
		}

		print_r($batts);
	}


	function json_decode($string) {
		if (!isset($this->json)) {
			require(dirname(__FILE__) . '/services-json/JSON.php');
			$this->json = new Services_JSON(SERVICES_JSON_LOOSE_TYPE);
		}
		$this->fields = array();

		$decoded = $this->json->decode($string);
		$this->json_decode_walker($decoded);
		return ;
	}

	function json_decode_walker($struct) {
		if (is_array($struct)) {
			if (isset($struct['type']) && isset($struct['id'])) {
				$this->fields[$struct['id']] = $struct['type'];
			}
			foreach ($struct as $k => $v) {
				if ($k)
					$v['id'] = $k;
				$this->json_decode_walker($v);
			}
		}
	}
}
