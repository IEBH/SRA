<div class="alert alert-info">
	This tool will accept a CSV file of references and compute the collaboration between all other authors.<br/>
	For example if two people have worked on multiple papers together each will get one point of collaboration.
</div>

<? $this->load->view('waveform/bootstrap') ?>
<form action="<?=SITE_ROOT?>tools/collabmatrix" method="post" class="form-horizontal" enctype="multipart/form-data">
	<?=$this->waveform->Table()?>
	<div class="pull-center">
		<button class="btn btn-success" action="submit"><i class="icon-ok"></i> Calculate</button>
	</div>
</form>
