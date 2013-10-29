<script type="batt" src="<?=SITE_ROOT?>batt/schema"></script>
<div class="alert alert-info">
	<h3><i class="icon-share-alt"></i> Share library</h3>
	<p>Enter the email address of the person you would like to share this reference library with.</p>
	<p>They will be provided with access to this library and have the ability to export the references in the format they choose.</p>
</div>
<script type="batt" action="<?=$_SERVER['REQUEST_URI']?>">
[
	{
		id: 'email',
		type: 'email',
		classes: 'input-block-level',
		title: 'Email address'
	},
	{
		type: 'button',
		action: 'submit',
		text: '<i class="icon-share"></i> Share library',
		classes: 'btn btn-success'
	}
]
</script>
