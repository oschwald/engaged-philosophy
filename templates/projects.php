<?php
/**
 * Template Name: Projects
 *
 * @package The Bootstrap
 */

get_header(); ?>

<section id="primary" class="col-12">

	<?php tha_content_before(); ?>

	<div id="content" role="main">
	<?php tha_content_top(); ?>

	<header class="page-header">
		<h1 class="page-title">Civic Engagement Projects</h1>
	</header><!-- .page-header -->
	<p>
		This page provides a list of examples of completed student projects
		organized by broad themes such as "animals" and "art." Click on one of
		the themes below to find a list of projects that fit under that theme.
		The bigger the the word is below, the more examples you will see.
	</p>
	<div class="row">
	<div class="card card-body bg-light col-lg-5 lead">
		<?php wp_tag_cloud( array( 'taxonomy' => 'topic' ) ); ?>
	</div>
	</div>

	<?php
	// Manual project query.
	$projects_query = new WP_Query(
		array(
			'post_type'      => 'project',
			'posts_per_page' => 20,
			'post_status'    => 'publish',
		)
	);

	if ( $projects_query->have_posts() ) :
		?>
		<div class="row">
		<?php
		while ( $projects_query->have_posts() ) :
			$projects_query->the_post();
			?>
			<div class="col-md-6">
				<article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
					<header class="entry-header">
						<h3 class="entry-title">
							<a href="<?php the_permalink(); ?>" title="<?php the_title_attribute(); ?>" rel="bookmark">
								<?php the_title(); ?>
							</a>
						</h3>
					</header>
					<div class="entry-content">
						<?php the_excerpt(); ?>
					</div>
				</article>
			</div>
		<?php endwhile; ?>
		</div>

		<?php if ( $projects_query->max_num_pages > 1 ) : ?>
			<nav class="navigation paging-navigation" role="navigation">
				<div class="nav-links">
					<?php
					echo paginate_links(
						array(
							'total'     => $projects_query->max_num_pages,
							'prev_text' => __( '&laquo; Previous' ),
							'next_text' => __( 'Next &raquo;' ),
						)
					);
					?>
				</div>
			</nav>
		<?php endif; ?>

	<?php else : ?>
		<p>No projects found.</p>
		<?php
	endif;
	wp_reset_postdata();
	?>

	<?php tha_content_bottom(); ?>
	</div><!-- #content -->
	<?php tha_content_after(); ?>
</section><!-- #primary -->

<?php
get_sidebar();
get_footer();