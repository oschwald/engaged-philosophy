<?php
/** Topic taxonomy template
 *
 * The template used to display Tag Archive pages
 *
 * @author      Konstantin Obenland
 * @package     The Bootstrap
 * @since       1.0.0 - 05.02.2012
 */

get_header(); ?>

<section id="primary" class="col-lg-8 px-4">

	<?php tha_content_before(); ?>
	<div id="content" role="main">
		<?php
		tha_content_top();

		if ( have_posts() ) :
			?>

			<header class="page-header">
				<h1 class="page-title">
				<?php
					printf( __( 'Project Topic: %s', 'the-bootstrap' ), '<span>' . esc_html( single_tag_title( '', false ) ) . '</span>' );
				?>
				</h1>

				<?php
				$tag_description = tag_description();
				if ( $tag_description ) {
					echo apply_filters( 'tag_archive_meta', '<div class="tag-archive-meta">' . $tag_description . '</div>' );
				}
				?>

			</header><!-- .page-header -->

			<?php
			while ( have_posts() ) {
				the_post();

				get_template_part( '/partials/content', 'summary' );
			}
			the_bootstrap_content_nav();
		else :
			get_template_part( '/partials/content', 'not-found' );
		endif;

		tha_content_bottom();
		?>
	</div><!-- #content -->
	<?php tha_content_after(); ?>
</section><!-- #primary -->

<?php
get_footer();

/*
End of file index.php
*/

/*
Location: ./wp-content/themes/the-bootstrap/tag.php
*/
