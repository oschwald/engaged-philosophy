<?php
/** content-page.php
 *
 * The template for displaying page content in the page.php template
 *
 * @author		Konstantin Obenland
 * @package		The Bootstrap
 * @since		1.0.0 - 07.02.2012
 */


tha_entry_before(); ?>
<article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
    <?php tha_entry_top(); ?>

    <header class="page-header">
        <?php the_title( '<h1 class="entry-title">', '</h1>' ); ?>
    </header><!-- .entry-header -->

    <div class="entry-content clearfix">
        <div class="row">
            <div class="span9">
                <?php
                    the_content( __( 'Continue reading <span class="meta-nav">&rarr;</span>', 'the-bootstrap' ) );
                    the_bootstrap_link_pages();
                ?>
            </div>
            <div class="span3">
                <div class="well">
                    <dl>
                        <?php
                            the_terms( $post->ID, 'schools', '<dt>College</dt><dd>', ', ', '</dd>' );
                            the_terms( $post->ID, 'professors', '<dt>Professor</dt><dd>', ', ', '</dd>' );
                            the_terms( $post->ID, 'courses', '<dt>Courses</dt><dd>', ', ', '</dd>' );
                            the_terms( $post->ID, 'semesters', '<dt>Semesters</dt><dd>', ', ', '</dd>' );

                        ?>
                    </dl>
                </div>
            </div>
        </div>
    </div>

    <?php edit_post_link( __( 'Edit', 'the-bootstrap' ), '<footer class="entry-meta"><span class="edit-link label">', '</span></footer>' );

    tha_entry_bottom(); ?>
</article><!-- #post-<?php the_ID(); ?> -->
<?php tha_entry_after();


/* End of file content-page.php */
/* Location: ./wp-content/themes/the-bootstrap/partials/content-page.php */
