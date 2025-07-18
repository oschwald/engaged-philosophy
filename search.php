<?php
/** Search results template
 *
 * The template for displaying Search Results pages.
 *
 * @author      Konstantin Obenland
 * @package     The Bootstrap
 * @since       1.0.0 - 07.02.2012
 */

get_header(); ?>

<div class="container-fluid">
	<div class="row">
	<section id="primary" class="col-lg-8 p-4">
		<?php tha_content_before(); ?>
		<div id="content" role="main">
		<?php
		tha_content_top();

		if ( have_posts() ) :
			?>

			<header class="page-header mb-4 pb-3 border-bottom">
				<h1 class="page-title h2 mb-0"><?php printf( __( 'Search Results for: %s', 'the-bootstrap' ), '<span>' . esc_html( get_search_query() ) . '</span>' ); ?></h1>
			</header>

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

	<?php get_sidebar(); ?>
	</div><!-- .row -->
</div><!-- .container-fluid -->

<?php
get_footer();

/*
End of file search.php
*/

/*
Location: ./wp-content/themes/the-bootstrap/search.php
*/
