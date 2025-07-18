<?php
/** Page template
 *
 * The template for displaying all pages.
 *
 * This is the template that displays all pages by default.
 * Please note that this is the WordPress construct of pages
 * and that other 'pages' on your WordPress site will use a
 * different template.
 *
 * @author      Konstantin Obenland
 * @package     The Bootstrap
 * @since       1.0.0 - 07.02.2012
 */

get_header(); ?>

<div class="container-fluid">
	<section id="primary" class="p-4">
	<?php tha_content_before(); ?>
	<div id="content" role="main">
		<?php
		tha_content_top();

		the_post();
		get_template_part( '/partials/content', 'page' );
		comments_template();

		tha_content_bottom();
		?>
	</div><!-- #content -->
	<?php tha_content_after(); ?>
	</section><!-- #primary -->
</div><!-- .container-fluid -->

<?php
get_footer();

/*
End of file page.php
*/

/*
Location: ./wp-content/themes/the-bootstrap/page.php
*/