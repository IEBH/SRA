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

	/**
	* Save a reference
	* NOTE: If $data['data'] is an array it will be converted back into JSON before saving - making it safe to pass complex arrays
	* NOTE: If any unknown field is passed as a key for $data it will be saved inside $data['data'] (as JSON)
	* @param int $referenceid The referenceID to save
	* @param array $data The data to save back to the object
	*/
	function Save($referenceid, $data) {
		$fields = array();
		foreach (qw('libraryid title authors data altdata') as $field)
			if (isset($data[$field])) {
				$fields[$field] = $data[$field];
				unset($data[$field]);
			}

		if ($data) { // Still have unknown fields to save
			if (isset($fields['data'])) { // Incomming (possible) JSON
				if (is_string($fields['data'])) // Not already an array - convert
					$fields['data'] = json_decode($fields['data'], true);
			} else { // Dont have any JSON to work with - fetch it
				$record = $this->Get($referenceid);
				$fields['data'] = $record['data'];
			}

			foreach ($data as $key => $value) // Save unknown fields
				$fields['data'][$key] = $value;
		}

		if ($fields) {
			$fields['edited'] = time();
			if (isset($fields['data']) && is_array($fields['data'])) // Convert data back into JSON if its an array
				$fields['data'] = json_encode($fields['data']);
			$this->db->where('referenceid', $referenceid);
			$this->db->update('references', $fields);
			return true;
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
	* Expands the $reference['data'] JSON blob, deletes it and returns the expanded array
	* @param array $reference The compacted reference to expand
	* @returns array The reference with its data JSON blob expanded
	*/
	function Explode($reference) {
		$json = json_decode($reference['data'], TRUE);
		unset($reference['data']);
		return array_merge($reference, $json);
	}

	/**
	* Compare two reference objects and return a boolean if they are similar
	* @param array $a The primary reference to compare
	* @param array $b The secondary (slave) reference to compare
	*/
	function Compare($a, $b) {
		$isdupe = 0;
		$alts = array(); // Alternate values we found
		$save = array(); // Data we should just save to A

		// Simple field comparison
		foreach (qw('title authors') as $f) {
			if ($a[$f] == $b[$f]) { // Exact match
				$isdupe = 1;
			} elseif ($this->StringCompare($a[$f], $b[$f])) {
				$isdupe = 1;
				$alts[$f] = $b[$f];
			}
		}

		// We've determined the data is a duplicate - now decide what to merge before we delete $b
		if ($isdupe) {
			$adata = json_decode($a['data'], true);
			$bdata = json_decode($b['data'], true);
			foreach (array_merge(array_keys($adata), array_keys($bdata)) as $key) {
				if (is_array($adata[$key]))
					$adata[$key] = implode(' AND ', $adata[$key]);
				if (is_array($bdata[$key]))
					$bdata[$key] = implode(' AND ', $bdata[$key]);

				if (!isset($adata[$key])) { // B has data that A does not -- Assign to A
					$save[$key] = $bdata[$key];
				} elseif (!isset($bdata[$key])) { // A has data that B does not
					// Do nothing - we dont care about B as its going to be deleted anyway
				} elseif ($adata[$key] == $bdata[$key]) { // Direct match A==B
					// Do nothing - we dont care about exact duplicates
				} else { // Not an exact match - store it as an alternate
					$alts[$key] = $bdata[$key];
				}
			}


			echo "DUPE {$a['referenceid']} == {$b['referenceid']}<br/>";
			$save['altdata'] = json_encode($alts);
			$this->Save($a['referenceid'], $save);
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
