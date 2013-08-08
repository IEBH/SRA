<?
class Library extends CI_Model {
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
