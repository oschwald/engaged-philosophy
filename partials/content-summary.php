<?php
/** Content summary template
 *
 * The template for displaying page content in the page.php template
 *
 * @author      Konstantin Obenland
 * @package     The Bootstrap
 * @since       1.0.0 - 07.02.2012
 */

tha_entry_before(); ?>
<article id="post-<?php the_ID(); ?>" <?php post_class( 'mb-5 pb-4 border-bottom' ); ?>>
	<?php tha_entry_top(); ?>

	<header class="page-header mb-3">
		<?php the_title( '<h2 class="entry-title h4 mb-0">', '</h2>' ); ?>
	</header><!-- .entry-header -->

	<div class="entry-content text-muted lh-base">
		<?php
			echo get_the_post_thumbnail( $post->ID, 'thumbnail', array( 'class' => 'img-thumbnail float-end ms-3' ) );
			the_excerpt();
			the_bootstrap_link_pages();
		?>
	</div><!-- .entry-content -->
	<?php
	edit_post_link( __( 'Edit', 'the-bootstrap' ), '<footer class="entry-meta"><span class="edit-link badge">', '</span></footer>' );

	tha_entry_bottom();
	?>
</article><!-- #post-<?php the_ID(); ?> -->
<?php
tha_entry_after();

/*
End of file content-page.php
*/

/*
Location: ./wp-content/themes/the-bootstrap/partials/content-page.php
*/
