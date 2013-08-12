<?
class Reference extends CI_Model {
	function Create($data) {
		$fields = array();
		foreach (qw('libraryid title authors data') as $field)
			if (isset($data[$field]))
				$fields[$field] = $data[$field];

		if ($fields) {
			$fields['created'] = time();
			$this->db->insert('references', $fields);
			return $this->db->insert_id();
		}
	}

	function GetAll($where = null, $orderby = 'referenceid', $limit = null, $offset = null) {
		$this->db->from('references');
		if ($where)
			$this->db->where($where);
		if ($orderby)
			$this->db->order_by($orderby);
		if ($limit || $offset)
			$this->db->limit($limit,$offset);
		return $this->db->get()->result_array();
	}

	function SetStatus($referenceid, $status) {
		$this->db->where('referenceid', $referenceid);
		$this->db->update('references', array(
			'status' => $status,
		));
	}

	/**
	* Compare two reference objects and return a boolean if they are similar
	* @param array $a The primary reference to compare
	* @param array $b The secondary (slave) reference to compare
	*/
	function Compare($a, $b) {
		$isdupe = 0;
		$alts = array();

		// Simple field comparison
		foreach (qw('title authors') as $f) {
			if ($a[$f] == $b[$f]) { // Exact match
				$isdupe = 1;
			} elseif ($this->StringCompare($a[$f], $b[$f])) {
				$isdupe = 1;
				$alts[$f] = $b[$f];
			}
		}

		if ($isdupe) {
			echo "DUPE {$a['referenceid']} == {$b['referenceid']}<br/>";
			print_r($alts);
			die();
			$this->SetStatus($b['referenceid'], 'deleted');
		}

		return $isdupe;
	}

	function StringCompare($a, $b) {
		$as = trim(preg_replace('/[^a-zA-z0-9]+/', ' ', $a));
		if (strlen($as) > 255)
			$as = substr($as, 0, 255);

		$bs = trim(preg_replace('/[^a-zA-z0-9]+/', ' ', $b));
		if (strlen($bs) > 255)
			$bs = substr($bs, 0, 255);

		if (levenshtein($as, $bs) < 10) {
			return true;
		}
		return false;
	}

	/**
	* Mark two reference objects as duplicates
	* @param array $a The primary reference to mark as a duplicate
	* @param array $b The secondary (slave) reference to mark as a duplicate
	*/
	function MarkDupe($a, $b) {
		$this->db->insert('referencedupes', array(
			'referenceid1' => $a['referenceid'],
			'referenceid2' => $b['referenceid'],
		));
	}

	/**
	* Get a list of all duplicate records
	*/
	function GetDupes() {
		$this->db->from('referencedupes');
		$this->db->join('references AS a', 'a.referenceid = referencedupes.referenceid1');
		$this->db->join('references AS b', 'b.referenceid = referencedupes.referenceid2');
		$this->db->order_by('referencedupes.referenceid1');
		return $this->db->get()->result_array();
	}
}
