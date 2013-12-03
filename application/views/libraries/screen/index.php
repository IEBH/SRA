<? $this->load->view('waveform/bootstrap') ?>
<div class="alert alert-info">
	<h3><i class="icon-filter"></i> Screen library</h3>
	<p>There are many different methods to screen a reference library.</p>
	<p>Choose the method below that matches the process you would like to start.</p>
</div>
<form action="<?=SITE_ROOT?>libraries/screen" method="post" class="form-horizontal">
	<?=$this->waveform->Table()?>
	<div class="pull-center">
		<button class="btn btn-success" action="submit"><i class="icon-filter"></i> Begin screening</button>
	</div>
</form>
