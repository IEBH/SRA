<?
class Library extends CI_Model {
	function Get($libraryid) {
		$this->db->from('libraries');
		$this->db->where('libraryid', $libraryid);
		$this->db->limit(1);
		return $this->db->get()->row_array();
	}

	function GetAll($where = null, $orderby = 'title') {
		$this->db->from('libraries');
		if ($where)
			$this->db->where($where);
		if ($orderby)
			$this->db->order_by($orderby);
		return $this->db->get()->result_array();
	}

	function Count($where = null) {
		$this->db->select('COUNT(*) AS count');
		$this->db->from('libraries');
		if ($where)
			$this->db->where($where);
		$row = $this->db->get()->row_array();
		return $row['count'];
	}

	function Create($data) {
		$fields = array();
		foreach (qw('title') as $field)
			if (isset($data[$field]))
				$fields[$field] = $data[$field];

		if ($fields) {
			$fields['userid'] = $this->User->GetActive('userid');
			$fields['created'] = time();
			$this->db->insert('libraries', $fields);
			return $this->db->insert_id();
		}
	}

	function Save($libraryid, $data) {
		$fields = array();
		foreach (qw('title') as $field)
			if (isset($data[$field]))
				$fields[$field] = $data[$field];

		if ($fields) {
			$fields['edited'] = time();
			$this->db->where('libraryid', $libraryid);
			$this->db->update('libraries', $fields);
			return $this->db->insert_id();
		}
	}

	function SaveDupeStatus($libraryid, $ref1, $ref2) {
		$this->db->where('libraryid', $libraryid);
		$this->db->update('libraries', array(
			'dedupe_refid' => $ref1,
			'dedupe_refid2' => $ref2,
		));
	}

	/**
	* Set the libraries.status value of a specific library
	* @param int $libraryid The libraryID to change
	*/
	function SetStatus($libraryid, $status) {
		$this->db->where('libraryid', $libraryid);
		$this->db->update('libraries', array(
			'status' => $status,
		));
	}
}
