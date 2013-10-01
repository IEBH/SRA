<?
class Reference extends CI_Model {
	function Get($referenceid) {
		$this->db->from('references');
		$this->db->where('referenceid', $referenceid);
		$this->db->limit(1);
		return $this->db->get()->row_array();
	}

	function GetByYourRef($yourref, $libraryid = null) {
		$this->db->from('references');
		$this->db->where('yourref', $yourref);
		$this->db->where('status', 'active');
		if ($libraryid)
			$this->db->where('libraryid', $libraryid);
		$this->db->limit(1);
		return $this->db->get()->row_array();
	}

	function Count($where = null) {
		$this->db->select('COUNT(*) AS count');
		$this->db->from('references');
		if ($where)
			$this->db->where($where);
		$row = $this->db->get()->row_array();
		return $row['count'];
	}

	function Create($data) {
		$fields = array();
		foreach (qw('libraryid title authors yourref data') as $field)
			if (isset($data[$field]))
				$fields[$field] = $data[$field];

		if ($fields) {
			if (isset($fields['data']) && is_array($fields['data'])) // Convert data back into JSON if its an array
				$fields['data'] = json_encode($fields['data']);
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
		foreach (qw('libraryid title authors data altdata status') as $field)
			if (isset($data[$field])) {
				$fields[$field] = $data[$field];
				unset($data[$field]);
			}

		if ($data) { // Still have unknown fields to save
			if (isset($fields['data'])) { // Incomming (possible) JSON
				if (is_string($fields['data'])) // Not already an array - convert
					$fields['data'] = json_decode($fields['data'], TRUE);
			} else { // Dont have any JSON to work with - fetch it
				$record = $this->Get($referenceid);
				$fields['data'] = json_decode($record['data'], TRUE);
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
	* Flattens arrays or returns already flattened string values
	* @param array|string $string Possible array or string to flatten
	* @return string The delimetered array or the $string unedited
	*/
	function Flatten($string, $delimeter = ' AND ') {
		if (is_string($string) || is_int($string)) {
			return $string;
		} elseif (is_array($string)) {
			return implode($delimeter, $string);
		} else {
			trigger_error("Dont know how to flatten string: $string");
		}
	}

	/**
	* Compare two reference objects and return a boolean if they are similar
	* @param array $a The primary reference to compare
	* @param array $b The secondary (slave) reference to compare
	* @param bool $debug If true a string is returned as to why the papers are not identical instead of boolean FALSE
	* @return bool|string Boolean indicating whether the papers are similar OR if $debug==true the reason why they match or not as a string
	*/
	function Compare($a, $b, $debug = FALSE) {
		$isdupe = false;
		$alts = array(); // Alternate values we found
		$save = array(); // Data we should just save to A

		// Simple field comparison
		foreach (qw('title authors') as $f) {
			if ($a[$f] == $b[$f]) { // Exact match
				$isdupe = $debug ? "$f matches exactly - '{$a[$f]}' == '{$b[$f]}'" : true;
			} elseif ($this->StringCompare($a[$f], $b[$f])) {
				$isdupe = $debug ? "$f matches roughly - '{$a[$f]}' =~ '{$b[$f]}'" : true;
				if (!isset($alts[$f]))
					$alts[$f] = array();
				$alts[$f][$b['referenceid']] = $b[$f];
			}
		}

		// We've determined the data is a duplicate - now decide what to merge before we delete $b
		if ($isdupe) {
			$adata = json_decode($a['data'], true);
			$bdata = json_decode($b['data'], true);

			// Basic sanity checks
			if (isset($adata['year'], $bdata['year']) && $adata['year'] != $bdata['year'])
				return $debug ? "Year mismatch '{$adata['year']}' != '{$bdata['year']}'" : false;
			if (isset($adata['pages'], $bdata['pages']) && $adata['pages'] != $bdata['pages'])
				return $debug ? "Pages mismatch '{$adata['pages']}' != '{$bdata['pages']}'" : false;
			if (isset($adata['volume'], $bdata['volume']) && $adata['volume'] != $bdata['volume'])
				return $debug ? "Volume mismatch '{$adata['volume']}' != '{$bdata['volume']}'" : false;
			if (isset($adata['isbn'], $bdata['isbn']) && $adata['isbn'] != $bdata['isbn'])
				return $debug ? "ISBN mismatch '{$adata['isbn']}' != '{$bdata['isbn']}'" : false;
			if (isset($adata['number'], $bdata['number']) && $adata['number'] != $bdata['number'])
				return $debug ? "Number mismatch '{$adata['number']}' != '{$bdata['number']}'" : false;

			foreach (array_merge(array_keys($adata), array_keys($bdata)) as $key) {
				if (isset($adata[$key]) && is_array($adata[$key]))
					$adata[$key] = implode(' AND ', $adata[$key]);
				if (isset($bdata[$key]) && is_array($bdata[$key]))
					$bdata[$key] = implode(' AND ', $bdata[$key]);

				if (!isset($adata[$key])) { // B has data that A does not -- Assign to A
					$save[$key] = $bdata[$key];
				} elseif (!isset($bdata[$key])) { // A has data that B does not
					// Do nothing - we dont care about B as its going to be deleted anyway
				} elseif ($adata[$key] == $bdata[$key]) { // Direct match A==B
					// Do nothing - we dont care about exact duplicates
				} else { // Not an exact match - store it as an alternate
					if (!isset($alts[$key])) // Alt key not set
						$alts[$key] = array();
					$alts[$key][$b['referenceid']] = $bdata[$key];
				}
			}

			//foreach($alts as $key => $vals) // Compress alt array
			//	$alts[$key] = array_unique($vals);

			$save['altdata'] = json_encode($alts);
			$this->Save($a['referenceid'], $save);
			$this->SetStatus($b['referenceid'], 'dupe');
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
