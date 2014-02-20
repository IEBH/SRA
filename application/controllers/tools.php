<?
class Tools extends CI_Controller {
	function __construct() {
		parent::__construct();
	}

	function CollabMatrix() {
		// Waveform config {{{
		$this->load->spark('waveform/1.0.0');
		
		$this->waveform->Define('file')
			->File();

		$this->waveform->Define('col')
			->Title('Author Column')
			->Default(2)
			->int();

		$this->waveform->Define('output')
			->Title('Output format')
			->Choice(array(
				'html' => 'HTML table',
				'html-raw' => 'HTML table (no styling)',
				'csv' => 'CSV output',
				'raw' => 'Raw output',
			));
		// }}}

		if ($fields = $this->waveform->ok()) {
			if (!$_FILES)
				$this->site->Error('No files uploaded');

			$sep = '|||';
			$authors = array();
			$matrix = array(); // Key = $author1$sep$author2

			foreach ($_FILES as $file) {
				if (!$file['tmp_name'] || !file_exists($file['tmp_name']))
					continue;
				$fh = fopen($file['tmp_name'], 'r');
				$line = 0;
				$col = $fields['col']-1;
				while ($bits = fgetcsv($fh)) {
					$line++;
					if (!isset($bits[$col]))
						$this->site->Error("Column {$fields['col']}, does not exist on line $line");
					$csvauthors = preg_split('/\s*,\s*/', $bits[$col]);
					foreach ($csvauthors as $a) {
						foreach ($csvauthors as $b) {
							if ($a == $b) // Skip if same person
								continue;
							if ($a > $b) // Sort low to high
								list($a, $b) = array($b, $a);
							if (!isset($authors[$a]))
								$authors[$a] = 1;
							if (!isset($authors[$b]))
								$authors[$b] = 1;
							if (!isset($matrix["$a$sep$b"])) {
								$matrix["$a$sep$b"] = 1;
							} else {
								$matrix["$a$sep$b"]++;
							}
						}
					}
					ksort($authors);
				}
				fclose($fh);
			}

			switch ($fields['output']) {
				case 'html':
					$this->site->Header('Results', array(
						'breadcrumbs' => array(
							'/tools' => 'Tools',
							'/tools/collabmatrix' => 'Collaboration Matrix',
						),
					));
					$this->site->view('tools/collabmatrix-html', array(
						'authors' => $authors,
						'matrix' => $matrix,
						'sep' => $sep,
					));
					$this->site->Footer();
					break;
				case 'html-raw':
					$this->site->SetTheme('minimal');
					$this->site->Header('Results', array(
						'breadcrumbs' => array(
							'/tools' => 'Tools',
							'/tools/collabmatrix' => 'Collaboration Matrix',
						),
					));
					$this->site->view('tools/collabmatrix-html', array(
						'authors' => $authors,
						'matrix' => $matrix,
						'sep' => $sep,
					));
					$this->site->Footer();
					break;
				case 'csv':
					header('Content-Encoding: UTF-8');
					header('Content-type: text/csv; charset=UTF-8');
					header('Content-Disposition: attachment; filename="Author Collaboration Matrix.csv"');
					// Header row {{{
					$line = '"",';
					foreach ($authors as $a => $junk)
						$line .= '"' . $a . '",';
					echo substr($line, 0, -1) . "\n";
					// }}}
					foreach ($authors as $a => $junk) {
						$line = '"' . $a . '",';
						foreach ($authors as $b => $junk) {
							$key = ($a < $b) ? "$a$sep$b" : "$b$sep$a";
							$line .= (isset($matrix[$key]) ? $matrix[$key] : '') . ',';
						}
						echo substr($line, 0, -1) . "\n";
					}
					break;
				case 'raw':
					header('Content-type: text/plain');
					print_r($matrix);
			}
		} else {
			$this->site->Header('Collaboration Matrix', array(
				'breadcrumbs' => array(
					'/tools' => 'Tools'
				),
			));
			$this->site->view('tools/collabmatrix');
			$this->site->Footer();
		}
	}
}
