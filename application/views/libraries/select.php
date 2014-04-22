<?
$this->Waveform->Style('form_submit', array('TAG' => 'button', 'type' => 'submit', 'class' => 'btn btn-success', 'CONTENT' => '<i class="icon-ok"></i> Process library', 'LEADIN' => '<div class="pull-center">', 'LEADOUT' => '</div>'));
?>
<script>
$(function() {
	$('select[name=libraryid]')
		.on('change', function() {
			if ($(this).val() == 'new') {
				$('input[name=file]').closest('.control-group').show();
			} else {
				$('input[name=file]').closest('.control-group').hide();
			}
		})
		.trigger('change');
});
</script>

<?=$this->Waveform->Form()?>
