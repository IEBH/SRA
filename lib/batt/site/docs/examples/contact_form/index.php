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
		title: 'Contact us'
	},
	{
		type: 'string',
		title: 'Your name',
		placeholder: 'John Smith'
	},
	{
		type: 'string',
		title: 'Your email address',
		placeholder: 'someone@somewhere.com'
	},
	{
		type: 'text',
		title: 'What did you want to say to us?',
		placeholder: 'I love you!'
	},
	{
		type: 'button',
		action: 'submit',
		text: '<i class="icon-envelope"></i> Send email',
		classes: 'btn btn-success'
	}
]);


});
</script>

</head>
<body>
	<div id="batt"></script>	
</body>
</html>
