<?php
/** home.php
 *
 * Template Name: Home
 */

get_header(); ?>


<section id="primary" class="col-12">
	<?php tha_content_before(); ?>
	<main id="content">
	<div class="row">
		<div id="projects_carousel" class="carousel slide col-lg-9 ps-3 pe-0" data-bs-ride="carousel">
		<div class="carousel-inner">
			<?php

			$carousel_query = new WP_Query(
				array(
					'post_type'      => 'project',
					'posts_per_page' => -1,
					'meta_query'     => array(
						array(
							'key'     => 'highlight',
							'compare' => 'EXISTS',
						),
					),
				)
			);

			if ( $carousel_query->have_posts() ) :
				$index = 0;
				while ( $carousel_query->have_posts() ) {
					$carousel_query->the_post();
					if ( has_post_thumbnail() && get_field( 'highlight' ) ) {
						?>
				<div class="carousel-item 
						<?php
						if ( $index === 0 ) {
							echo 'active';}
						?>
				">
						<?php
						the_post_thumbnail( array( 700, 460 ), array( 'alt' => get_the_title() . ' project image' ) );
						?>
				<div class="carousel-caption">
					<h4><?php the_title(); ?></h4>
						<?php the_excerpt(); ?>
				</div>
				</div>
						<?php
						++$index;
					}
				}
			endif;
			wp_reset_postdata();

			?>
		</div>
		<button class="carousel-control-prev" type="button" data-bs-target="#projects_carousel" data-bs-slide="prev">
			<span class="carousel-control-prev-icon" aria-hidden="true"></span>
			<span class="visually-hidden">Previous</span>
		</button>
		<button class="carousel-control-next" type="button" data-bs-target="#projects_carousel" data-bs-slide="next">
			<span class="carousel-control-next-icon" aria-hidden="true"></span>
			<span class="visually-hidden">Next</span>
		</button>
		</div>
		<div class="col-lg-3">
		<div class="lead-home">
			<?php
			the_post();
			the_content();
			?>
		</div>
		</div>
	</div>
	<div class="row mt-4">
		<div class="col-lg-4 mb-4">
		<h2><?php the_field( 'box-left-title' ); ?></h2>
		<?php the_field( 'box-left' ); ?>
		</div>
		<div class="col-lg-4 mb-4">
		<h2><?php the_field( 'box-middle-title' ); ?></h2>
		<?php the_field( 'box-middle' ); ?>
		</div>
		<div class="col-lg-4 mb-4">
		<h2><?php the_field( 'box-right-title' ); ?></h2>
		<?php the_field( 'box-right' ); ?>
		</div>
	</div>
<?php
	tha_content_bottom();
?>

	</main><!-- #content -->
	<?php tha_content_after(); ?>
</section><!-- #primary -->

<?php
get_footer();


/*
End of file _full_width.php */
/* Location: ./wp-content/themes/the-bootstrap/_full_width.php */
