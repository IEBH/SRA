<?
class Basket extends CI_Model {
	function __construct() {
		parent::__construct();
		// New Session - Basket {{{
		if (!isset($_SESSION['basket']))
			$_SESSION['basket'] = array();
		// }}}
	}

	function Add($ref, $data) {
		$_SESSION['basket'][$ref] = $data;
	}

	function Remove($ref) {
		unset($_SESSION['basket'][$ref]);
	}

	function Has($ref) {
		return isset($_SESSION['basket'][$ref]);
	}
}
