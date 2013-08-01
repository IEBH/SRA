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
		type: 'heading',
		title: 'Simple test form'
	},
	{
		type: 'string',
		title: 'String',
		default: 'foo bar',
		placeholder: 'Enter foo value here'
	},
	{
		type: 'number',
		title: 'Number',
		placeholder: 'Number placeholder',
		default: 10,
		min: 1,
		max: 5
	},
	{
		type: 'text',
		title: 'Text',
		placeholder: 'Text placeholder',
		default: 'Hello World'
	},
	{
		type: 'choice',
		title: 'Choice',
		choices: {
			'foo': 'Foo',
			'bar': 'Bar',
			'baz': 'Baz'
		},
		default: 'baz'
	},
	{
		type: 'choice_radio',
		title: 'Choice Radio',
		choices: {
			'foo': 'Foo',
			'bar': 'Bar',
			'baz': 'Baz'
		},
		default: 'bar'
	},
	{
		type: 'date',
		title: 'Date',
		default: 'bar'
	},
	{
		type: 'link',
		title: 'Link',
		default: 'http://google.com.au'
	},
	{
		type: 'dropdown',
		title: 'Dropdown',
		children: [
			{
				type: 'link', // Type can be implicit
				title: 'Foo',
				action: '/examples'
			},
			{
				// Or ignored (batt_dropdown assumes 'link' type if unspcified)
				title: 'Bar',
				action: '/examples'
			},
			{
				title: 'Baz',
				action: '/examples'
			},
		]
	},
	{
		type: 'html',
		text: '<div class="alert alert-info">HTML blob</div>'
	},
	{
		type: 'button',
		action: 'submit',
		text: '<i class="icon-ok"></i> Save',
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
