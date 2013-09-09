<!DOCTYPE HTML>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>Batt test form</title>

	<? include('../../src/batt_debug.php') ?>
</head>
<body>

<script type="batt">
[
	{
		type: 'heading',
		title: 'Upload a file'
	},
	{
		id: 'file',	
		type: 'file',
		title: 'Files to upload',
		autoDuplicate: true
	},
	{
		type: 'button',
		action: 'submit',
		text: '<i class="icon-plus"></i> Upload files',
		classes: 'btn btn-success'
	}
]
</script>

</body>
</html>
