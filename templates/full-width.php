<?php
/** _full_width.php
 *
 * Template Name: Full Width
 *
 * @author  Konstantin Obenland
 * @package The Bootstrap
 * @since   1.3.0   - 29.04.2012
 */

get_header(); ?>

<section id="primary" class="col-12 px-4">
	<?php tha_content_before(); ?>
	<main id="content">
		<?php
		tha_content_top();

		the_post();
		get_template_part( '/partials/content', 'page' );
		comments_template( '', true );

		tha_content_bottom();
		?>
	</main><!-- #content -->
	<?php tha_content_after(); ?>
</section><!-- #primary -->

<?php
get_footer();

/*
End of file _full_width.php
*/

/*
Location: ./wp-content/themes/the-bootstrap/_full_width.php
*/