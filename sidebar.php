<?php
/** Sidebar template
 *
 * @author      Konstantin Obenland
 * @package     The Bootstrap
 * @since       1.0.0   - 05.02.2012
 */

tha_sidebars_before(); ?>
<section id="secondary" class="widget-area col-lg-4 p-3" role="complementary">
	<?php
	tha_sidebar_top();

	if ( ! dynamic_sidebar( 'main' ) ) {
		the_widget(
			'WP_Widget_Archives',
			array(
				'count'    => 0,
				'dropdown' => 0,
			),
			array(
				'before_widget' => '<aside id="archives" class="widget card mb-4 widget_archives">',
				'after_widget'  => '</aside>',
				'before_title'  => '<h3 class="widget-title card-header h5 mb-0">',
				'after_title'   => '</h3>',
			)
		);
		the_widget(
			'WP_Widget_Meta',
			array(),
			array(
				'before_widget' => '<aside id="meta" class="widget card mb-4 widget_meta">',
				'after_widget'  => '</aside>',
				'before_title'  => '<h3 class="widget-title card-header h5 mb-0">',
				'after_title'   => '</h3>',
			)
		);
	} // End sidebar widget area.

	tha_sidebar_bottom();
	?>
</section><!-- #secondary .widget-area -->
<?php
tha_sidebars_after();

/*
End of file sidebar.php
*/

/*
Location: ./wp-content/themes/the-bootstrap/sidebar.php
*/