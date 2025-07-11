<?php
/** archive.php
 *
 * The template for displaying Archive pages.
 *
 * Used to display archive-type pages if nothing more specific matches a query.
 * For example, puts together date-based pages if no date.php file exists.
 *
 * Learn more: http://codex.wordpress.org/Template_Hierarchy
 *
 * @author		Konstantin Obenland
 * @package		The Bootstrap
 * @since		1.0.0 - 07.02.2012
 */

get_header(); ?>

<script>
jQuery(document).ready(function ($) {
  $('#projects_carousel').carousel()
});
</script>
<section id="primary" class="col-12 px-4">

  <?php tha_content_before(); ?>

  <main id="content">
    <?php tha_content_top();

    if (have_posts()) : ?>

    <header class="page-header">
      <h1 class="page-title">Civic Engagement Projects</h1>
    </header><!-- .page-header -->
    <p>
        This page provides a list of examples of completed student projects
        organized by broad themes such as “animals” and “art.” Click on one of
        the themes below to find a list of projects that fit under that theme.
        The bigger the the word is below, the more examples you will see.
    </p>
    <div class="row">
    <div class="col-lg-8 offset-lg-2">
      <div class="card card-body tag-cloud-projects">
      <?php
        // Generate tag cloud with fixed randomization
        $tag_cloud = wp_tag_cloud(array(
          'taxonomy' => 'topic',
          'smallest' => 13,
          'largest' => 32,
          'unit' => 'px',
          'format' => 'flat',
          'separator' => ' ',
          'orderby' => 'RAND',
          'number' => 40,
          'echo' => false
        ));

        // Parse and shuffle with fixed seed for consistency
        if ($tag_cloud) {
          // Use regex to extract complete <a> tags instead of splitting on spaces
          preg_match_all('/<a[^>]*>.*?<\/a>/', $tag_cloud, $matches);
          $tags = $matches[0];

          // Use a seed based on the current date to shuffle consistently per day
          mt_srand(date('Ymd'));
          shuffle($tags);
          echo implode(' ', $tags);
        }
      ?>
      </div>
    </div>
    </div>
    <?php
    else :
     get_template_part('/partials/content', 'not-found');
   endif;

   tha_content_bottom(); ?>
</main><!-- #content -->
<?php tha_content_after(); ?>
</section><!-- #primary -->

<?php
get_footer();

/* End of file archive.php */
/* Location: ./wp-content/themes/the-bootstrap/archive.php */
