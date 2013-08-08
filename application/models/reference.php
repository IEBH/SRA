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
}
