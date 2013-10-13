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

<script type="text/javascript">
jQuery(document).ready(function ($) {
  $('#projects_carousel').carousel()
});
</script>
<section id="primary" class="span12">

  <?php tha_content_before(); ?>

  <div id="content" role="main">
    <?php tha_content_top();

    if (have_posts()) : ?>

    <header class="page-header">
      <h1 class="page-title">Civic Engagement Projects</h1>
    </header><!-- .page-header -->
    <div class="lead">
      <?php wp_tag_cloud(array('taxonomy' => 'topic')) ?>
    </div>
    <?php
    else :
     get_template_part('/partials/content', 'not-found');
   endif;

   tha_content_bottom(); ?>
 </div>
</div><!-- #content -->
<?php tha_content_after(); ?>
</section><!-- #primary -->

<?php
get_footer();

/* End of file archive.php */
/* Location: ./wp-content/themes/the-bootstrap/archive.php */
