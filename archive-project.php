<?php
/** Project archive template
 *
 * The template for displaying Archive pages.
 *
 * Used to display archive-type pages if nothing more specific matches a query.
 * for example, puts together date-based pages if no date.php file exists.
 *
 * Learn more: http://codex.wordpress.org/Template_Hierarchy
 *
 * @author      Konstantin Obenland
 * @package     The Bootstrap
 * @since       1.0.0 - 07.02.2012
 */

get_header(); ?>


<div class="container-fluid">
	<section id="primary" class="p-4">
	<?php tha_content_before(); ?>
	<main id="content">
	<?php
	tha_content_top();

	if ( have_posts() ) :
		?>

	<header class="page-header mb-4 pb-3 border-bottom">
	<h1 class="page-title h2 mb-0">Civic Engagement Projects</h1>
	</header><!-- .page-header -->
	<p>
		This page provides a list of examples of completed student projects
		organized by broad themes such as "animals" and "art." Click on one of
		the themes below to find a list of projects that fit under that theme.
		The bigger the the word is below, the more examples you will see.
	</p>
	<div class="row">
	<div class="col-12">
		<div class="tag-cloud-projects">
		<?php
		// Generate tag cloud with fixed randomization.
		$tag_cloud = wp_tag_cloud(
			array(
				'taxonomy'  => 'topic',
				'smallest'  => 13,
				'largest'   => 32,
				'unit'      => 'px',
				'format'    => 'flat',
				'separator' => ' ',
				'orderby'   => 'RAND',
				'number'    => 40,
				'echo'      => false,
			)
		);

		// Parse and shuffle with fixed seed for consistency.
		if ( $tag_cloud ) {
			// Use regex to extract complete <a> tags instead of splitting on spaces.
			preg_match_all( '/<a[^>]*>.*?<\/a>/', $tag_cloud, $matches );
			$tags = $matches[0];

			// Create a deterministic shuffle based on current date for consistent daily order.
			$date_seed     = (int) gmdate( 'Ymd' );
			$shuffled_tags = array();
			$tag_count     = count( $tags );

			// Create deterministic pseudo-random order based on date.
			for ( $i = 0; $i < $tag_count; $i++ ) {
				$pseudo_random = ( $date_seed + $i * 31 ) % $tag_count;
				while ( isset( $shuffled_tags[ $pseudo_random ] ) ) {
					$pseudo_random = ( ++$pseudo_random ) % $tag_count;
				}
				$shuffled_tags[ $pseudo_random ] = $tags[ $i ];
			}
			ksort( $shuffled_tags );
			$tags = array_values( $shuffled_tags );
			echo implode( ' ', $tags );
		}
		?>
		</div>
	</div>
	</div>
		<?php
	else :
		get_template_part( '/partials/content', 'not-found' );
endif;

	tha_content_bottom();
	?>
	</main><!-- #content -->
	<?php tha_content_after(); ?>
	</section><!-- #primary -->
</div><!-- .container-fluid -->

<?php
get_footer();

/*
End of file archive.php
*/

/*
Location: ./wp-content/themes/the-bootstrap/archive.php
*/
