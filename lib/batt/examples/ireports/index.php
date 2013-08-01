<!DOCTYPE HTML>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>Batt test form</title>

	<? include('../../src/batt_debug.php') ?>

<script>
$(function() {

$('#batt').batt([
	{
		uses: 'ireports',
		type: 'table',
		dataSource: {
			table: 'ireports',
			filter: {},
		},
		columns: [
			{
				type: 'dropdown',
				children: [
					{
						title: 'Edit',
						action: 'form.php#{{data.id}}'
					},
					{
						title: 'Delete',
						action: 'FIXME#{{data.id}}'
					},
				]
			},
			{
				type: 'link',
				title: 'Report #',
				text: "{{data.id}}",
				action: 'form.php#{{data.id}}'
			},
			{
				type: 'link',
				title: 'Status',
				text: "{{data.status}}",
				action: 'form.php#{{data.id}}'
			},
			{
				type: 'link',
				title: 'Location',
				text: "{{data.sector}} / {{data.level}}",
				action: 'form.php#{{data.id}}'
			},
			{
				type: 'link',
				title: 'Description',
				text: "{{data.description}}",
				action: 'form.php#{{data.id}}'
			},
		]
	},
	{
		type: 'button',
		action: 'FIXME#',
		text: '<i class="icon-plus"></i> Create new Inpection Report',
		class: 'btn btn-success'
	}
]);

});
</script>

</head>
<body>
	<div id="batt"></script>	
</body>
</html>
