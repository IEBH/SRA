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

	function Compare($a, $b) {
		return TRUE;
	}
}
