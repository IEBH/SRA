<? $this->load->view('waveform/bootstrap') ?>
<?=$this->waveform->Form()?>
<script>
$(function() {
	$('select[name=where]')
		.on('change', function() {
			if ($(this).val() == 'new') {
				$('input[name=name_new]').closest('.control-group').show();
				$('select[name=existing_id]').closest('.control-group').hide();
			} else {
				$('input[name=name_new]').closest('.control-group').hide();
				$('select[name=existing_id]').closest('.control-group').show();
			}
		})
		.trigger('change');
	$('input[name=advanced]')
		.on('change', function() {
			$('[name=auto_dedupe], [name=debug]').parents('.control-group')
				.toggle($(this).is(':checked'));
		})
		.trigger('change');
});
</script>
