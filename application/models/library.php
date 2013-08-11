<?
class Library extends CI_Model {
	function Get($libraryid) {
		$this->db->from('libraries');
		$this->db->where('libraryid', $libraryid);
		$this->db->limit(1);
		return $this->db->get()->row_array();
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
}
