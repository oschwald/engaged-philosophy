<?php
/** Custom header implementation
 *
 * Implementation of the Custom Header feature
 * http://codex.wordpress.org/Custom_Headers
 *
 * @author      Automattic, Konstantin Obenland
 * @package     The Bootstrap
 * @since       1.2.0 - 05.04.2012
 */

/**
 * Adds Custom Header support
 *
 * @author  Automattic
 * @since   1.2.0 - 05.04.2012
 *
 * @return  void
 */
function the_bootstrap_custom_header_setup() {
	$args = apply_filters(
		'the_bootstrap_custom_header_args',
		array(
			'default-image'          => '',

			// The height and width of your custom header.
			// Add a filter to the_bootstrap_header_image_width and the_bootstrap_header_image_height to change these values.
			'width'                  => apply_filters( 'the_bootstrap_header_image_width', 481 ),
			'height'                 => apply_filters( 'the_bootstrap_header_image_height', 102 ),
			'flex-height'            => true,

			// The default header text color.
			'default-text-color'     => '333333',

			// Add a way for the custom header to be styled in the admin panel that controls custom headers.
			'wp-head-callback'       => 'the_bootstrap_header_style',
			'admin-head-callback'    => 'the_bootstrap_admin_header_style',
			'admin-preview-callback' => 'the_bootstrap_admin_header_image',
		)
	);

	add_theme_support( 'custom-header', $args );
}
add_action( 'after_setup_theme', 'the_bootstrap_custom_header_setup', 11 );


if ( ! function_exists( 'the_bootstrap_header_style' ) ) :
	/**
	 * Styles the header image and text displayed on the blog
	 *
	 * @author  Automattic
	 * @since   1.2.0 - 05.04.2012
	 *
	 * @return  void
	 */
	function the_bootstrap_header_style() {

		// If no custom options for text are set, let's bail.
		// get_header_textcolor() options: get_theme_support( 'custom-header', 'default-text-color' ) is default, hide text (returns 'blank') or any hex value.
		if ( get_theme_support( 'custom-header', 'default-text-color' ) !== get_header_textcolor() ) :
			?>
	<style>
			<?php if ( 'blank' === get_header_textcolor() ) : ?>
		#branding hgroup {
			position: absolute !important;
			clip: rect(1px 1px 1px 1px); /* IE6, IE7 */
			clip: rect(1px, 1px, 1px, 1px);
		}
		<?php else : ?>
		#site-description {
			color: #<?php echo get_header_textcolor(); ?> !important;
		}
		<?php endif; ?>
	</style>
			<?php
		endif;
	}
endif; // The_bootstrap_header_style.


if ( ! function_exists( 'the_bootstrap_admin_header_style' ) ) :
	/**
	 * Styles the header image displayed on the Appearance > Header admin panel.
	 *
	 * @author  Automattic
	 * @since   1.2.0 - 05.04.2012
	 *
	 * @return  void
	 */
	function the_bootstrap_admin_header_style() {
		?>
	<style>
	.appearance_page_custom-header #headimg {
		border: none;
	}
	#headimg h1,
	#desc {
		font-weight: bold;
		line-height: 36px;
		margin: 0;
	}
	#headimg h1 {
		font-size: 30px;
	}
	#headimg h1 a {
		color: #0088CC !important;
		font-weight: bold;
		text-decoration: none;
	}
	#headimg h1 a:hover {
		color: #005580 !important;
		text-decoration: underline;
	}
	#desc {
		color: #<?php echo get_header_textcolor(); ?> !important;
		font-size: 24px;
	}
	#headimg img {
	}
	</style>
		<?php
	}
endif; // The_bootstrap_admin_header_style.


if ( ! function_exists( 'the_bootstrap_admin_header_image' ) ) :
	/**
	 * Custom header image markup displayed on the Appearance > Header admin panel.
	 *
	 * @author  Automattic
	 * @since   1.2.0 - 05.04.2012
	 *
	 * @return  void
	 */
	function the_bootstrap_admin_header_image() {

		?>
	<div id="headimg">
			<?php $class = ( 'blank' === get_header_textcolor() || ! get_header_textcolor() ) ? ' class="d-none"' : ''; ?>

		<h1<?php echo esc_attr( $class ); ?>><a id="name" href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php bloginfo( 'name' ); ?></a></h1>
		<div id="desc"<?php echo esc_attr( $class ); ?>><?php bloginfo( 'description' ); ?></div>
			<?php if ( get_header_image() ) : ?>
			<img src="<?php echo esc_url( get_header_image() ); ?>" alt="" />
		<?php endif; ?>
	</div>
		<?php
	}
endif; // The_bootstrap_admin_header_image.


if ( ! function_exists( 'get_custom_header' ) ) :
	/**
	 * Get the header image data.
	 *
	 * @author  WordPress.org
	 * @since   1.2.5 - 11.04.2012
	 *
	 * @return  object
	 */
	function get_custom_header() {
		$header_image_data = get_theme_support( 'custom-header' );
		return (object) array(
			'url'           => get_header_image(),
			'thumbnail_url' => get_header_image(),
			'width'         => $header_image_data[0]['width'],
			'height'        => $header_image_data[0]['height'],
		);
	}
endif; // Get_custom_header.

/*
End of file custom-header.php
*/

/*
Location: ./wp-content/themes/the-bootstrap/inc/custom-header.php
*/
