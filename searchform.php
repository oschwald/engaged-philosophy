<?php
/** searchform.php
 *
 * The template for displaying search forms
 *
 * @author		Konstantin Obenland
 * @package		The Bootstrap
 * @since		1.0.0 - 07.02.2012
 */
?>
<form method="get" id="searchform" class="d-flex" action="<?php echo esc_url( home_url( '/' ) ); ?>">
	<label for="s" class="visually-hidden"><?php _e( 'Search', 'the-bootstrap' ); ?></label>
	<div class="input-group">
		<input id="s" class="form-control" type="search" name="s" placeholder="<?php esc_attr_e( 'Search', 'the-bootstrap' ); ?>">
		<button class="btn btn-primary" name="submit" id="searchsubmit" type="submit"><?php _e( 'Go', 'the-bootstrap' ); ?></button>
   	</div>
</form>
<?php


/* End of file searchform.php */
/* Location: ./wp-content/themes/the-bootstrap/searchform.php */