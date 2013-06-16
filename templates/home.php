<?php
/** home.php
 *
 * Template Name: Home
 *
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
    <div class="row">
      <div id="projects_carousel" class="carousel slide span9">
        <div class="carousel-inner">
          <?php

          query_posts(array ( 'post_type' => 'project', 'posts_per_page' => -1 ));

          if (have_posts()):
            $index = 0;
          while (have_posts()) {
            the_post();
            if (has_post_thumbnail() && get_field('highlight')) {
              ?>
              <div class="item <?php if ($index === 0) echo "active" ?>">
                <?php the_post_thumbnail(array(700, 460)); ?>
                <div class="carousel-caption">
                  <h4><?php the_title(); ?></h4>
                  <?php the_excerpt(); ?>
                </div>
              </div>
              <?php
              $index++;
            }
          }
          endif;
          wp_reset_query();
          wp_reset_postdata();

          ?>
        </div>
        <a class="left carousel-control" href="#projects_carousel" data-slide="prev">&lsaquo;</a>
        <a class="right carousel-control" href="#projects_carousel" data-slide="next">&rsaquo;</a>
      </div>
      <div class="span3">
        <div class="well lead lead-home">
          <?php
          the_post();
          the_content();
          ?>
        </div>
      </div>
    </div>
    <div class="row">
      <div class="span4">
        <h2><?php the_field('box-left-title'); ?></h2>
        <?php the_field('box-left'); ?>
      </div>
      <div class="span4">
        <h2><?php the_field('box-middle-title'); ?></h2>
        <?php the_field('box-middle'); ?>
      </div>
      <div class="span4">
        <h2><?php the_field('box-right-title'); ?></h2>
        <?php the_field('box-right'); ?>
      </div>
    </div>
<?php
    tha_content_bottom();
    ?>

  </div><!-- #content -->
  <?php tha_content_after(); ?>
</section><!-- #primary -->

<?php
get_footer();


/* End of file _full_width.php */
/* Location: ./wp-content/themes/the-bootstrap/_full_width.php */
