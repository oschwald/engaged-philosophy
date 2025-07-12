<?php
/** Author archive template
 *
 * The template for displaying Author Archive pages.
 *
 * @author      Konstantin Obenland
 * @package     The Bootstrap
 * @since       1.0.0 - 07.02.2012
 */

get_header(); ?>

<section id="primary" class="col-lg-8 px-4">

	<?php tha_content_before(); ?>
	<div id="content" role="main">
		<?php
		tha_content_top();

		if ( have_posts() ) :
			the_post();
			?>

			<header class="page-header">
				<h1 class="page-title author"><?php printf( __( 'Author Archives: %s', 'the-bootstrap' ), '<span class="vcard"><a class="url fn n" href="' . esc_url( get_author_posts_url( (int) get_the_author_meta( 'ID' ) ) ) . '" title="' . esc_attr( get_the_author() ) . '" rel="me">' . esc_html( get_the_author() ) . '</a></span>' ); ?></h1>
			</header><!-- .page-header -->

			<?php
			rewind_posts();
			// If a user has filled out their description, show a bio on their entries.
			if ( get_the_author_meta( 'description' ) ) :
				?>
			<div id="author-info" class="row">
				<h2 class="col-lg-8"><?php printf( __( 'About %s', 'the-bootstrap' ), esc_html( get_the_author() ) ); ?></h2>
				<div id="author-avatar" class="col-lg-1">
					<?php echo get_avatar( get_the_author_meta( 'user_email' ), apply_filters( 'the_bootstrap_author_bio_avatar_size', 70 ) ); ?>
				</div><!-- #author-avatar -->
				<div id="author-description" class="col-lg-7">
					<?php the_author_meta( 'description' ); ?>
				</div><!-- #author-description	-->
			</div><!-- #author-info -->
				<?php
			endif;

			while ( have_posts() ) {
				the_post();
				get_template_part( '/partials/content', get_post_format() );
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
get_sidebar();
get_footer();

/*
End of file author.php
*/

/*
Location: ./wp-content/themes/the-bootstrap/author.php
*/