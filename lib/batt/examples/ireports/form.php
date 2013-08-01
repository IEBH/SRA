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
		dataSource: {
			table: 'ireports',
			filter: {},
			limit: 1
		},
		type: 'container',
		container: 'box',
		children: [
			{
				type: 'tabs',
				children: [
					{
						type: 'container',
						title: 'Details',
						children: [
							{id: 'id'},
							{
								type: 'heading',
								title: 'Location'
							},
							{id: 'sector'},
							{id: 'level'},
							{
								type: 'heading',
								title: 'General Information'
							},
							{id: 'stage'},
							{id: 'classification'},
							{id: 'description'},
							{
								type: 'heading',
								title: 'Creation information'
							},
							{id: 'creator'},
							{id: 'created'},
							{id: 'edited'}
						]
					},
					{
						type: 'container',
						title: 'Reinspections',
						children: [
							// FIXME
						]
					},
					{
						type: 'container',
						title: 'Notes',
						children: [
							{id: 'notes'}
						]
					},
				]
			},
			{
				type: 'button',
				action: 'save',
				class: 'btn btn-success',
				text: '<i class="icon-ok"></i> Save'
			}
		]
	},
	{
		type: 'container',
		class: 'box',
		children: [
			{
				type: 'table',
				children: [
					{
						type: 'dropdown',
						children: [
							{
								type: 'dropdown-item',
								title: 'Edit item',
								action: 'FIXME#{{this.id}}'
							},
							{
								type: 'dropdown-item',
								title: 'Responsible Company',
								action: 'FIXME#{{this.id}}'
							},
							{
								type: 'dropdown-item',
								title: 'Delete Item',
								action: 'FIXME#{{this.id}}'
							},
							{
								type: 'dropdown-item',
								title: 'Set as Complete',
								action: 'FIXME#{{this.id}}'
							},
							{
								type: 'dropdown-item',
								title: 'Set as Accepted',
								action: 'FIXME#{{this.id}}'
							},
						]
					},
					{
						type: 'link',
						title: 'Item #',
						text: "{{this.id}}",
						action: 'FIXME#{{this.id}}'
					},
					{
						type: 'link',
						title: 'Status',
						text: "{{this.status}}",
						action: 'FIXME#{{this.id}}'
					},
					{
						type: 'link',
						title: 'Grid',
						text: "{{this.grid}}",
						action: 'FIXME#{{this.id}}'
					},
					{
						type: 'link',
						title: 'Element / Sub-Element / Description',
						text: "{{this.element}} / {{this.subelement}} / {{this.description}}",
						action: 'FIXME#{{this.id}}'
					},
					{
						type: 'link',
						title: 'Company',
						text: "{{this.company}}",
						action: 'FIXME#{{this.id}}'
					},
				]
			}
		]
	}
]);

});
</script>

</head>
<body>
	<div id="batt"></script>	
</body>
</html>
