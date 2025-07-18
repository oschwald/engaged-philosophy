<?php
/** Functions.php
 *
 * @author      Greg
 * @package     Engaged Philosophy
 * @since       1.0.0 - 2012-11-25
 */

if ( ! function_exists( 'the_bootstrap_setup' ) ) :
	/**
	 * Sets up theme defaults and registers support for various WordPress features.
	 *
	 * @author  WordPress.org
	 * @since   1.0.0 - 05.02.2012
	 *
	 * @return  void
	 */
	function the_bootstrap_setup() {
		global $content_width;

		if ( ! isset( $content_width ) ) {
			$content_width = 940;
		}

		load_theme_textdomain( 'the-bootstrap', get_template_directory() . '/lang' );

		add_theme_support( 'automatic-feed-links' );

		add_theme_support( 'post-thumbnails' );

		add_theme_support(
			'post-formats',
			array(
				'aside',
				'chat',
				'link',
				'gallery',
				'status',
				'quote',
				'image',
				'video',
			)
		);

		add_theme_support( 'tha_hooks', array( 'all' ) );

		// Add theme support for custom logo and favicon.
		add_theme_support( 'custom-logo' );
		add_theme_support( 'site-icon' );
		add_theme_support( 'title-tag' );

		// Theme Customizer.
		require_once get_template_directory() . '/inc/theme-customizer.php';

		/**
		 * Custom template tags for this theme.
		 */
		require_once get_template_directory() . '/inc/template-tags.php';

		/**
		 * Implement the Custom Header feature
		 */
		require_once get_template_directory() . '/inc/custom-header.php';

		/**
		 * Custom Nav Menu handler for the Navbar.
		 */
		require_once get_template_directory() . '/inc/class-the-bootstrap-nav-walker.php';
		require_once get_template_directory() . '/inc/nav-menu-functions.php';

		/**
		 * Theme Hook Alliance
		 */
		require_if_theme_supports( 'tha_hooks', get_template_directory() . '/inc/tha-theme-hooks.php' );

		/**
		 * Including three menu (header-menu, primary and footer-menu).
		 * Primary is wrapping in a navbar containing div (wich support responsive variation).
		 * Header-menu and Footer-menu are inside pills dropdown menu
		 *
		 * @since   1.2.2 - 07.04.2012
		 * @see     http://codex.wordpress.org/Function_Reference/register_nav_menus
		 */
		register_nav_menus(
			array(
				'primary'     => __( 'Main Navigation', 'the-bootstrap' ),
				'header-menu' => __( 'Header Menu', 'the-bootstrap' ),
				'footer-menu' => __( 'Footer Menu', 'the-bootstrap' ),
			)
		);
	} // The_bootstrap_setup.
endif;
add_action( 'after_setup_theme', 'the_bootstrap_setup' );


/**
 * Returns the options object for The Bootstrap.
 *
 * @author  Automattic
 * @since   1.3.0 - 06.04.2012
 *
 * @return  stdClass    Theme Options
 */
function the_bootstrap_options() {
	return (object) wp_parse_args(
		get_option( 'the_bootstrap_theme_options', array() ),
		the_bootstrap_get_default_theme_options()
	);
}


/**
 * Returns the default options for The Bootstrap.
 *
 * @author  Automattic
 * @since   1.3.0 - 06.04.2012
 *
 * @return  array
 */
function the_bootstrap_get_default_theme_options() {
	$default_theme_options = array(
		'theme_layout'      => 'content-sidebar',
		'navbar_site_name'  => false,
		'navbar_searchform' => true,
		'navbar_inverse'    => false,
		'navbar_position'   => 'static',
	);

	return apply_filters( 'the_bootstrap_default_theme_options', $default_theme_options );
}


/**
 * Adds The Bootstrap layout classes to the array of body classes.
 *
 * @author  WordPress.org
 * @since   1.3.0 - 06.04.2012
 *
 * @param   array $existing_classes Existing body classes.
 *
 * @return  array Modified array of body classes.
 */
function the_bootstrap_layout_classes( $existing_classes ) {
	$classes = array( the_bootstrap_options()->theme_layout );
	$classes = apply_filters( 'the_bootstrap_layout_classes', $classes );

	return array_merge( $existing_classes, $classes );
}
add_filter( 'body_class', 'the_bootstrap_layout_classes' );


/**
 * Adds Custom Background support.
 *
 * @author  Konstantin Obenland
 * @since   1.2.5 - 11.04.2012
 *
 * @return  void
 */
function the_bootstrap_custom_background_setup() {
	$args = apply_filters(
		'the_bootstrap_custom_background_args',
		array(
			'default-color' => 'EFEFEF',
		)
	);

	add_theme_support( 'custom-background', $args );
}
add_action( 'after_setup_theme', 'the_bootstrap_custom_background_setup' );


/**
 * Register the sidebars.
 *
 * @author  Konstantin Obenland
 * @since   1.0.0 - 05.02.2012
 *
 * @return  void
 */
function the_bootstrap_widgets_init() {
	register_sidebar(
		array(
			'name'          => __( 'Main Sidebar', 'the-bootstrap' ),
			'id'            => 'main',
			'before_widget' => '<aside id="%1$s" class="widget card mb-4 %2$s">',
			'after_widget'  => '</aside>',
			'before_title'  => '<h2 class="widget-title card-header h5 mb-0">',
			'after_title'   => '</h2>',
		)
	);

	register_sidebar(
		array(
			'name'          => __( 'Image Sidebar', 'the-bootstrap' ),
			'description'   => __( 'Shown on image attachment pages.', 'the-bootstrap' ),
			'id'            => 'image',
			'before_widget' => '<aside id="%1$s" class="widget card mb-4 %2$s">',
			'after_widget'  => '</aside>',
			'before_title'  => '<h2 class="widget-title card-header h5 mb-0">',
			'after_title'   => '</h2>',
		)
	);

	include_once 'inc/class-the-bootstrap-image-meta-widget.php';
	register_widget( 'The_Bootstrap_Image_Meta_Widget' );

	include_once 'inc/class-the-bootstrap-gallery-widget.php';
	register_widget( 'The_Bootstrap_Gallery_Widget' );
}
add_action( 'widgets_init', 'the_bootstrap_widgets_init' );


/**
 * Registration of theme scripts and styles.
 *
 * @author  Konstantin Obenland
 * @since   1.0.0 - 05.02.2012
 *
 * @return  void
 */
function the_bootstrap_register_scripts_styles() {
	if ( ! is_admin() ) {
		$theme_version = _the_bootstrap_version();
		$suffix        = ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) ? '' : '.min';

		/**
		 * Scripts
		 */
		wp_register_script(
			'the-bootstrap',
			get_template_directory_uri() . '/build/theme-scripts.js',
			array(),
			$theme_version,
			true
		);

		/**
		 * Styles
		 */
		wp_register_style(
			'my-bootstrap',
			get_template_directory_uri() . '/build/style-style.css',
			array(),
			$theme_version
		);

		// Register Bootstrap Icons.
		wp_register_style(
			'bootstrap-icons',
			'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css',
			array(),
			'1.11.0'
		);
	}
}
add_action( 'init', 'the_bootstrap_register_scripts_styles' );


/**
 * Properly enqueue frontend scripts.
 *
 * @author  Konstantin Obenland
 * @since   1.0.0 - 05.02.2012
 *
 * @return  void
 */
function the_bootstrap_print_scripts() {
	wp_enqueue_script( 'the-bootstrap' );
}
add_action( 'wp_enqueue_scripts', 'the_bootstrap_print_scripts' );




/**
 * Properly enqueue comment-reply script.
 *
 * @author  Konstantin Obenland
 * @since   1.4.0 - 08.05.2012
 *
 * @return  void
 */
function the_bootstrap_comment_reply() {
	if ( get_option( 'thread_comments' ) ) {
		wp_enqueue_script( 'comment-reply' );
	}
}
add_action( 'comment_form_before', 'the_bootstrap_comment_reply' );


/**
 * Properly enqueue frontend styles.
 *
 * Since 'tw-bootstrap' was registered as a dependency, it'll get enqueued
 * automatically.
 *
 * @author  Konstantin Obenland
 * @since   1.0.0 - 05.02.2012
 *
 * @return  void
 */
function the_bootstrap_print_styles() {
	if ( is_child_theme() ) {
		wp_enqueue_style( 'the-bootstrap-child', get_stylesheet_uri(), array( 'the-bootstrap' ), wp_get_theme()->get( 'Version' ) );
	} else {
		wp_enqueue_style( 'my-bootstrap' );
	}

	// Enqueue Bootstrap Icons.
	wp_enqueue_style( 'bootstrap-icons' );

	if ( 'static' !== the_bootstrap_options()->navbar_position ) {
		$top_bottom = str_replace( 'navbar-fixed-', '', the_bootstrap_options()->navbar_position );
		$css        = "body > .container{margin-{$top_bottom}:68px;}@media(min-width: 980px){body > .container{margin-{$top_bottom}:58px;}}";

		if ( is_admin_bar_showing() && 'top' === $top_bottom ) {
			$css .= '.navbar.navbar-fixed-top{margin-top:28px;}';
		}

		if ( function_exists( 'wp_add_inline_style' ) ) {
			wp_add_inline_style( 'the-bootstrap', $css );
		} else {
			echo "<style>\n{$css}\n</style>\n";
		}
	}
}
add_action( 'wp_enqueue_scripts', 'the_bootstrap_print_styles' );


if ( ! function_exists( 'the_bootstrap_credits' ) ) :
	/**
	 * Prints HTML with meta information for the current post-date/time and author,
	 * comment and edit link.
	 *
	 * @author  Konstantin Obenland
	 * @since   1.2.2 - 07.04.2012
	 *
	 * @return  void
	 */
	function the_bootstrap_credits() {
		printf(
			'<span class="credits alignleft">' . __( '&copy; %1$s <a href="%2$s">%3$s</a>, all rights reserved.', 'the-bootstrap' ) . '</span>',
			esc_html( gmdate( 'Y' ) ),
			esc_url( home_url( '/' ) ),
			esc_html( get_bloginfo( 'name' ) )
		);
	}
endif;


/**
 * Returns the blogname if no title was set.
 *
 * @author  Konstantin Obenland
 * @since   1.1.0 - 18.03.2012
 *
 * @param   string $title The current page title.
 * @param   string $sep   The separator character.
 *
 * @return  string The modified page title.
 */
function the_bootstrap_wp_title( $title, $sep ) {
	if ( ! is_feed() ) {
		$title .= get_bloginfo( 'name' );

		if ( is_front_page() ) {
			$title .= " {$sep} " . get_bloginfo( 'description' );
		}
	}

	return $title;
}
add_filter( 'wp_title', 'the_bootstrap_wp_title', 1, 2 );


/**
 * Returns a "Continue Reading" link for excerpts.
 *
 * @author  WordPress.org
 * @since   1.0.0 - 05.02.2012
 *
 * @return  string The continue reading link HTML.
 */
function the_bootstrap_continue_reading_link() {
	return ' <a href="' . esc_url( get_permalink() ) . '">' . __( 'Continue reading <span class="meta-nav">&rarr;</span>', 'the-bootstrap' ) . '</a>';
}


/**
 * Replaces "[...]" (appended to automatically generated excerpts) with an ellipsis and the_bootstrap_continue_reading_link().
 *
 * To override this in a child theme, remove the filter and add your own
 * function tied to the excerpt_more filter hook.
 *
 * @author  WordPress.org
 * @since   1.0.0 - 05.02.2012
 *
 * @param   string $_more The "more" string.
 *
 * @return  string The modified "more" string.
 */
function the_bootstrap_auto_excerpt_more( $_more ) {
	return '&hellip;' . the_bootstrap_continue_reading_link();
}
add_filter( 'excerpt_more', 'the_bootstrap_auto_excerpt_more' );


/**
 * Adds a pretty "Continue Reading" link to custom post excerpts.
 *
 * To override this link in a child theme, remove the filter and add your own
 * function tied to the get_the_excerpt filter hook.
 *
 * @author  WordPress.org
 * @since   1.0.0 - 05.02.2012
 *
 * @param   string $output The excerpt output.
 *
 * @return  string The modified excerpt output.
 */
function the_bootstrap_custom_excerpt_more( $output ) {
	if ( has_excerpt() && ! is_attachment() ) {
		$output .= the_bootstrap_continue_reading_link();
	}
	return $output;
}
add_filter( 'get_the_excerpt', 'the_bootstrap_custom_excerpt_more' );


/**
 * Get the wp_nav_menu() fallback, wp_page_menu(), to show a home link.
 *
 * @author  WordPress.org
 * @since   1.0.0 - 05.02.2012
 *
 * @param   array $args Menu arguments.
 *
 * @return  array Modified menu arguments.
 */
function the_bootstrap_page_menu_args( $args ) {
	$args['show_home'] = true;
	return $args;
}
add_filter( 'wp_page_menu_args', 'the_bootstrap_page_menu_args' );


/**
 * Filter in a link to a content ID attribute for the next/previous image links on image attachment pages.
 *
 * @author  Automattic
 * @since   1.0.0 - 05.02.2012
 *
 * @param   string $url The attachment URL.
 * @param   int    $id  The attachment ID.
 *
 * @return  string The modified URL.
 */
function the_bootstrap_enhanced_image_navigation( $url, $id ) {
	if ( is_attachment() && wp_attachment_is_image( $id ) ) {
		$image = get_post( $id );
		if ( $image->post_parent && $image->post_parent !== $id ) {
			$url .= '#primary';
		}
	}

	return $url;
}
add_filter( 'attachment_link', 'the_bootstrap_enhanced_image_navigation', 10, 2 );


/**
 * Displays comment list, when there are any.
 *
 * @author  Konstantin Obenland
 * @since   1.7.0 - 16.06.2012
 *
 * @return  void
 */
function the_bootstrap_comments_list() {
	if ( post_password_required() ) : ?>
		<div id="comments">
			<p class="nopassword"><?php esc_html_e( 'This post is password protected. Enter the password to view any comments.', 'the-bootstrap' ); ?></p>
		</div><!-- #comments -->
		<?php
		return;
	endif;

	if ( have_comments() ) :
		?>
		<div id="comments">
			<h2 id="comments-title">
				<?php
				printf(
					/* translators: 1: comment count number, 2: title. */
					_n( '%1$s thought on &ldquo;%2$s&rdquo;', '%1$s thoughts on &ldquo;%2$s&rdquo;', get_comments_number(), 'the-bootstrap' ),
					number_format_i18n( get_comments_number() ),
					'<span>' . get_the_title() . '</span>'
				);
				?>
			</h2>

			<?php the_bootstrap_comment_nav(); ?>

			<ol class="commentlist list-unstyled">
				<?php wp_list_comments( array( 'callback' => 'the_bootstrap_comment' ) ); ?>
			</ol><!-- .commentlist .unstyled -->

			<?php the_bootstrap_comment_nav(); ?>

		</div><!-- #comments -->
		<?php
	endif;
}
add_action( 'comment_form_before', 'the_bootstrap_comments_list', 0 );
add_action( 'comment_form_comments_closed', 'the_bootstrap_comments_list', 1 );


/**
 * Echoes comments-are-closed message when post type supports comments and we're
 * not on a page.
 *
 * @author  Konstantin Obenland
 * @since   1.7.0 - 16.06.2012
 *
 * @return  void
 */
function the_bootstrap_comments_closed() {
	if ( ! is_page() && post_type_supports( get_post_type(), 'comments' ) ) :
		?>
		<p class="nocomments"><?php esc_html_e( 'Comments are closed.', 'the-bootstrap' ); ?></p>
		<?php
	endif;
}
add_action( 'comment_form_comments_closed', 'the_bootstrap_comments_closed' );


/**
 * Filters comments_form() default arguments.
 *
 * @author  Konstantin Obenland
 * @since   1.7.0 - 16.06.2012
 *
 * @param   array $defaults Default arguments for the comment form.
 *
 * @return  array Modified comment form arguments.
 */
function the_bootstrap_comment_form_defaults( $defaults ) {
	return wp_parse_args(
		array(
			'comment_field'        => '<div class="comment-form-comment mb-3"><label class="form-label" for="comment">' . _x( 'Comment', 'noun', 'the-bootstrap' ) . '</label><textarea class="form-control" id="comment" name="comment" rows="8" aria-required="true"></textarea></div>',
			'comment_notes_before' => '',
			'comment_notes_after'  => '<div class="form-allowed-tags mb-3"><label class="form-label">' . sprintf( __( 'You may use these <abbr title="HyperText Markup Language">HTML</abbr> tags and attributes: %s', 'the-bootstrap' ), '<pre>' . allowed_tags() . '</pre>' ) . '</label></div>
                                     <div class="d-flex gap-2">',
			'title_reply'          => '<legend>' . __( 'Leave a reply', 'the-bootstrap' ) . '</legend>',
			'title_reply_to'       => '<legend>' . __( 'Leave a reply to %s', 'the-bootstrap' ) . '</legend>',
			'must_log_in'          => '<div class="must-log-in mb-3">' . sprintf( __( 'You must be <a href="%s">logged in</a> to post a comment.', 'the-bootstrap' ), esc_url( wp_login_url( apply_filters( 'the_permalink', get_permalink( get_the_ID() ) ) ) ) ) . '</div>',
			'logged_in_as'         => '<div class="logged-in-as mb-3">' . sprintf( __( 'Logged in as <a href="%1$s">%2$s</a>. <a href="%3$s" title="Log out of this account">Log out?</a>', 'the-bootstrap' ), esc_url( admin_url( 'profile.php' ) ), esc_html( wp_get_current_user()->display_name ), esc_url( wp_logout_url( apply_filters( 'the_permalink', get_permalink( get_the_ID() ) ) ) ) ) . '</div>',
		),
		$defaults
	);
}
add_filter( 'comment_form_defaults', 'the_bootstrap_comment_form_defaults' );


if ( ! function_exists( 'the_bootstrap_comment' ) ) :
	/**
	 * Template for comments and pingbacks.
	 *
	 * To override this walker in a child theme without modifying the comments template
	 * simply create your own the_bootstrap_comment(), and that function will be used instead.
	 *
	 * Used as a callback by wp_list_comments() for displaying the comments.
	 *
	 * @author  Konstantin Obenland
	 * @since   1.0.0 - 05.02.2012
	 *
	 * @param   object $comment The comment data object.
	 * @param   array  $args    The comment list arguments.
	 * @param   int    $depth   The depth of comment in reference to parents.
	 *
	 * @return  void
	 */
	function the_bootstrap_comment( $comment, $args, $depth ) {
		// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
		$GLOBALS['comment'] = $comment;
		if ( 'pingback' === $comment->comment_type || 'trackback' === $comment->comment_type ) :
			?>

		<li id="li-comment-<?php comment_ID(); ?>" <?php comment_class(); ?>>
			<p class="row">
				<strong class="ping-label col-lg-1"><?php esc_html_e( 'Pingback:', 'the-bootstrap' ); ?></strong>
				<span class="col-lg-7">
				<?php
				comment_author_link();
				edit_comment_link( __( 'Edit', 'the-bootstrap' ), '<span class="sep">&nbsp;</span><span class="edit-link badge">', '</span>' );
				?>
				</span>
			</p>

			<?php
	else :
			$offset = $depth - 1;
			$span   = 7 - $offset;
		?>

		<li  id="li-comment-<?php comment_ID(); ?>" <?php comment_class(); ?>>
			<article id="comment-<?php comment_ID(); ?>" class="comment row">
				<div class="comment-author-avatar col-lg-1
				<?php
				if ( $offset ) {
					echo esc_attr( " offset-lg-{$offset}" );}
				?>
				">
					<?php echo get_avatar( $comment, 70 ); ?>
				</div>
				<footer class="comment-meta col-lg-<?php echo esc_attr( (string) $span ); ?>">
					<p class="comment-author vcard">
						<?php
							/*
							 * Translators: 1: comment author, 2: date and time
							 */
							printf(
								__( '%1$s <span class="says">said</span> on %2$s:', 'the-bootstrap' ),
								sprintf( '<span class="fn">%s</span>', get_comment_author_link() ),
								sprintf(
									'<a href="%1$s"><time pubdate datetime="%2$s">%3$s</time></a>',
									esc_url( get_comment_link( $comment->comment_ID ) ),
									get_comment_time( 'c' ),
									/* translators: 1: date, 2: time */
									sprintf( __( '%1$s at %2$s', 'the-bootstrap' ), get_comment_date(), get_comment_time() )
								)
							);
							edit_comment_link( __( 'Edit', 'the-bootstrap' ), '<span class="sep">&nbsp;</span><span class="edit-link label">', '</span>' );
						?>
					</p><!-- .comment-author .vcard -->

					<?php if ( ! $comment->comment_approved ) : ?>
					<div class="comment-awaiting-moderation alert alert-info"><em><?php esc_html_e( 'Your comment is awaiting moderation.', 'the-bootstrap' ); ?></em></div>
					<?php endif; ?>

				</footer><!-- .comment-meta -->

				<div class="comment-content col-lg-<?php echo esc_attr( (string) $span ); ?>">
					<?php
					comment_text();
					comment_reply_link(
						array_merge(
							$args,
							array(
								'reply_text' => __( 'Reply <span>&darr;</span>', 'the-bootstrap' ),
								'depth'      => $depth,
								'max_depth'  => $args['max_depth'],
							)
						)
					);
					?>
				</div><!-- .comment-content -->
			</article><!-- #comment-<?php comment_ID(); ?> .comment -->

		<?php
	endif; // Comment_type.
	}
endif; // Ends check for the_bootstrap_comment().


/**
 * Adds markup to the comment form which is needed to make it work with Bootstrap.
 *
 * @author  Konstantin Obenland
 * @since   1.0.0 - 05.02.2012
 *
 * @return  void
 */
function the_bootstrap_comment_form_top() {
	echo '<div class="mb-3">';
}
add_action( 'comment_form_top', 'the_bootstrap_comment_form_top' );


/**
 * Adds markup to the comment form which is needed to make it work with Bootstrap.
 *
 * @author  Konstantin Obenland
 * @since   1.0.0 - 05.02.2012
 *
 * @return  void
 */
function the_bootstrap_comment_form() {
	echo '</div></div>';
}
add_action( 'comment_form', 'the_bootstrap_comment_form' );


/**
 * Custom author form field for the comments form.
 *
 * @author  Konstantin Obenland
 * @since   1.0.0 - 05.02.2012
 *
 * @param   string $_html The original HTML for the author field.
 *
 * @return  string The modified HTML for the author field.
 */
function the_bootstrap_comment_form_field_author( $_html ) {
	$commenter = wp_get_current_commenter();
	$req       = get_option( 'require_name_email' );
	$aria_req  = ( $req ? " aria-required='true'" : '' );

	return '<div class="comment-form-author mb-3">
                <label for="author" class="form-label">' . esc_html__( 'Name', 'the-bootstrap' ) . '</label>
                <input class="form-control" id="author" name="author" type="text" value="' . esc_attr( $commenter['comment_author'] ) . '" size="30"' . $aria_req . ' />
                ' . ( $req ? '<div class="form-text"><span class="text-danger">' . esc_html__( 'required', 'the-bootstrap' ) . '</span></div>' : '' ) . '
            </div>';
}
add_filter( 'comment_form_field_author', 'the_bootstrap_comment_form_field_author' );


/**
 * Custom HTML5 email form field for the comments form.
 *
 * @author  Konstantin Obenland
 * @since   1.0.0 - 05.02.2012
 *
 * @param   string $_html The original HTML for the email field.
 *
 * @return  string The modified HTML for the email field.
 */
function the_bootstrap_comment_form_field_email( $_html ) {
	$commenter = wp_get_current_commenter();
	$req       = get_option( 'require_name_email' );
	$aria_req  = ( $req ? " aria-required='true'" : '' );

	return '<div class="comment-form-email mb-3">
                <label for="email" class="form-label">' . esc_html__( 'Email', 'the-bootstrap' ) . '</label>
                <input class="form-control" id="email" name="email" type="email" value="' . esc_attr( $commenter['comment_author_email'] ) . '" size="30"' . $aria_req . ' />
                <div class="form-text">' . ( $req ? '<span class="text-danger">' . esc_html__( 'required', 'the-bootstrap' ) . '</span>, ' : '' ) . esc_html__( 'will not be published', 'the-bootstrap' ) . '</div>
            </div>';
}
add_filter( 'comment_form_field_email', 'the_bootstrap_comment_form_field_email' );


/**
 * Custom HTML5 url form field for the comments form.
 *
 * @author  Konstantin Obenland
 * @since   1.0.0 - 05.02.2012
 *
 * @param   string $_html The original HTML for the URL field.
 *
 * @return  string The modified HTML for the URL field.
 */
function the_bootstrap_comment_form_field_url( $_html ) {
	$commenter = wp_get_current_commenter();

	return '<div class="comment-form-url mb-3">
                <label for="url" class="form-label">' . esc_html__( 'Website', 'the-bootstrap' ) . '</label>
                <input class="form-control" id="url" name="url" type="url" value="' . esc_attr( $commenter['comment_author_url'] ) . '" size="30" />
            </div>';
}
add_filter( 'comment_form_field_url', 'the_bootstrap_comment_form_field_url' );


/**
 * Adjusts an attachment link to hold the class of 'thumbnail' and make it look
 * pretty.
 *
 * @author  Konstantin Obenland
 * @since   1.0.0 - 05.02.2012
 *
 * @param   string $link      The attachment link HTML.
 * @param   int    $id        Post ID.
 * @param   string $size      Default is 'thumbnail'. Size of image, either array or string.
 * @param   bool   $permalink Default is false. Whether to add permalink to image.
 * @param   bool   $icon      Default is false. Whether to include icon.
 * @param   string $text      Default is false. If string, then will be link text.
 *
 * @return  string The modified attachment link HTML.
 */
function the_bootstrap_get_attachment_link( $link, $id, $size, $permalink, $icon, $text ) {
	return ( ! $text ) ? str_replace( '<a ', '<a class="d-inline-block border rounded" ', $link ) : $link;
}
add_filter( 'wp_get_attachment_link', 'the_bootstrap_get_attachment_link', 10, 6 );


/**
 * Adds the 'hero-unit' class for extra big font on sticky posts.
 *
 * @author  Konstantin Obenland
 * @since   1.0.0 - 05.02.2012
 *
 * @param   array $classes Existing post classes.
 *
 * @return  array Modified post classes.
 */
function the_bootstrap_post_classes( $classes ) {
	if ( is_sticky() && is_home() ) {
		$classes[] = 'p-5 mb-4 bg-light rounded-3'; // Bootstrap 5 jumbotron equivalent.
	}

	return $classes;
}
add_filter( 'post_class', 'the_bootstrap_post_classes' );


/**
 * Callback function to display galleries (in HTML5).
 *
 * @author  Konstantin Obenland
 * @since   1.0.0 - 05.02.2012
 *
 * @param   string $content The original gallery shortcode content.
 * @param   array  $attr    The gallery shortcode attributes.
 *
 * @return  string The gallery HTML output.
 */
function the_bootstrap_post_gallery( $content, $attr ) {
	global $instance, $post;
	++$instance;

	// We're trusting author input, so let's at least make sure it looks like a valid orderby statement.
	if ( isset( $attr['orderby'] ) ) {
		$attr['orderby'] = sanitize_sql_orderby( $attr['orderby'] );
		if ( ! $attr['orderby'] ) {
			unset( $attr['orderby'] );
		}
	}

	$shortcode_attrs = shortcode_atts(
		array(
			'order'      => 'ASC',
			'orderby'    => 'menu_order ID',
			'id'         => $post->ID,
			'itemtag'    => 'figure',
			'icontag'    => 'div',
			'captiontag' => 'figcaption',
			'columns'    => 3,
			'size'       => 'thumbnail',
			'include'    => '',
			'exclude'    => '',
		),
		$attr
	);

	$order      = $shortcode_attrs['order'];
	$orderby    = $shortcode_attrs['orderby'];
	$id         = $shortcode_attrs['id'];
	$itemtag    = $shortcode_attrs['itemtag'];
	$icontag    = $shortcode_attrs['icontag'];
	$captiontag = $shortcode_attrs['captiontag'];
	$columns    = $shortcode_attrs['columns'];
	$size       = $shortcode_attrs['size'];
	$include    = $shortcode_attrs['include'];
	$exclude    = $shortcode_attrs['exclude'];

	$id = intval( $id );
	if ( 'RAND' === $order ) {
		$orderby = 'none';
	}

	if ( $include ) {
		$include       = preg_replace( '/[^0-9,]+/', '', $include );
		$include_array = array_map( 'intval', explode( ',', $include ) );
		$_attachments  = get_posts(
			array(
				'include'        => $include_array,
				'post_status'    => 'inherit',
				'post_type'      => 'attachment',
				'post_mime_type' => 'image',
				'order'          => $order,
				'orderby'        => $orderby,
			)
		);

		$attachments = array();
		foreach ( $_attachments as $key => $val ) {
			$attachments[ $val->ID ] = $_attachments[ $key ];
		}
	} elseif ( $exclude ) {
		$exclude     = preg_replace( '/[^0-9,]+/', '', $exclude );
		$attachments = get_children(
			array(
				'post_parent'    => $id,
				'exclude'        => $exclude,
				'post_status'    => 'inherit',
				'post_type'      => 'attachment',
				'post_mime_type' => 'image',
				'order'          => $order,
				'orderby'        => $orderby,
			)
		);
	} else {
		$attachments = get_children(
			array(
				'post_parent'    => $id,
				'post_status'    => 'inherit',
				'post_type'      => 'attachment',
				'post_mime_type' => 'image',
				'order'          => $order,
				'orderby'        => $orderby,
			)
		);
	}

	if ( empty( $attachments ) ) {
		return '';
	}

	if ( is_feed() ) {
		$output = "\n";
		foreach ( $attachments as $att_id => $attachment ) {
			$output .= wp_get_attachment_link( $att_id, $size, true ) . "\n";
		}
		return $output;
	}

	$itemtag    = tag_escape( $itemtag );
	$captiontag = tag_escape( $captiontag );
	$columns    = intval( min( array( 8, $columns ) ) );
	$float      = ( is_rtl() ) ? 'right' : 'left';

	if ( 4 > $columns ) {
		$size = 'full';
	}

	$selector   = "gallery-{$instance}";
	$size_class = sanitize_html_class( $size );
	$output     = "<ul id='$selector' class='gallery galleryid-{$id} gallery-columns-{$columns} gallery-size-{$size_class} list-unstyled d-flex flex-wrap'>";

	$i = 0;
	foreach ( $attachments as $id => $attachment ) {
		$comments = (int) get_comments(
			array(
				'post_id' => $id,
				'count'   => true,
				'type'    => 'comment',
				'status'  => 'approve',
			)
		);

		$link        = wp_get_attachment_link( $id, $size, ! ( isset( $attr['link'] ) && 'file' === $attr['link'] ) );
		$clear_class = ( 0 === $i % $columns ) ? ' clear' : '';
		++$i;
		$col_class = 'col-' . floor( 12 / $columns );

		$output .= '<li class="' . esc_attr( $col_class . $clear_class . ' mb-3' ) . '"><' . esc_html( $itemtag ) . ' class="gallery-item">';
		$output .= "<{$icontag} class='gallery-icon'>{$link}</{$icontag}>\n";

		if ( $captiontag && ( 0 < $comments || trim( $attachment->post_excerpt ) ) ) {
			$comments = ( 0 < $comments ) ? sprintf( _n( '%d comment', '%d comments', $comments, 'the-bootstrap' ), $comments ) : '';
			$excerpt  = wptexturize( $attachment->post_excerpt );
			$out      = ( $comments && $excerpt ) ? " $excerpt <br /> $comments " : " $excerpt$comments ";
			$output  .= "<{$captiontag} class='wp-caption-text gallery-caption'>{$out}</{$captiontag}>\n";
		}
		$output .= "</{$itemtag}></li>\n";
	}
	$output .= "</ul>\n";

	return $output;
}


/**
 * HTML 5 caption for pictures.
 *
 * @author  Konstantin Obenland
 * @since   1.0.0 - 05.02.2012
 *
 * @param   string $output   Output parameter.
 * @param   array  $attr    The caption shortcode attributes.
 * @param   string $content The caption shortcode content.
 *
 * @return  string The caption HTML.
 */
function the_bootstrap_img_caption_shortcode( $output, $attr, $content ) {
	$shortcode_attrs = shortcode_atts(
		array(
			'id'      => '',
			'align'   => 'alignnone',
			'width'   => '',
			'caption' => '',
		),
		$attr
	);

	$id      = $shortcode_attrs['id'];
	$align   = $shortcode_attrs['align'];
	$width   = $shortcode_attrs['width'];
	$caption = $shortcode_attrs['caption'];

	if ( 1 > (int) $width || empty( $caption ) ) {
		return $content;
	}

	if ( $id ) {
		$id = 'id="' . $id . '" ';
	}

	return '<figure ' . $id . 'class="wp-caption figure ' . $align . '">
                ' . do_shortcode( str_replace( 'class="figure', 'class="figure-img img-fluid"', $content ) ) . '
                <figcaption class="wp-caption-text figure-caption">' . $caption . '</figcaption>
            </figure>';
}
add_filter( 'img_caption_shortcode', 'the_bootstrap_img_caption_shortcode', 10, 3 );


/**
 * Returns a password form which displays nicely with Bootstrap.
 *
 * @author  Konstantin Obenland
 * @since   1.0.0 - 05.02.2012
 *
 * @param   string $_form The original password form HTML.
 *
 * @return  string The Bootstrap-styled password form.
 */
function the_bootstrap_the_password_form( $_form ) {
	return '<form class="post-password-form" action="' . esc_url( home_url( 'wp-pass.php' ) ) . '" method="post"><h4 class="mb-3">' . esc_html__( 'This post is password protected. To view it please enter your password below:', 'the-bootstrap' ) . '</h4><div class="mb-3"><label class="form-label" for="post-password-' . get_the_ID() . '">' . esc_html__( 'Password:', 'the-bootstrap' ) . '</label><input class="form-control" name="post_password" id="post-password-' . get_the_ID() . '" type="password" size="20" /></div><div class="mb-3"><button type="submit" class="post-password-submit submit btn btn-primary">' . esc_html__( 'Submit', 'the-bootstrap' ) . '</button></div></form>';
}
add_filter( 'the_password_form', 'the_bootstrap_the_password_form' );


/**
 * Modifies the category dropdown args for widgets on 404 pages.
 *
 * @author  Konstantin Obenland
 * @since   1.5.0 - 19.05.2012
 *
 * @param   array $args The original widget category dropdown arguments.
 *
 * @return  array The modified widget category dropdown arguments.
 */
function the_bootstrap_widget_categories_dropdown_args( $args ) {
	if ( is_404() ) {
		$args = wp_parse_args(
			$args,
			array(
				'orderby'    => 'count',
				'order'      => 'DESC',
				'show_count' => 1,
				'title_li'   => '',
				'number'     => 10,
			)
		);
	}
	return $args;
}
add_filter( 'widget_categories_dropdown_args', 'the_bootstrap_widget_categories_dropdown_args' );


/**
 * Adds the .thumbnail class when images are sent to editor.
 *
 * @author  Konstantin Obenland
 * @since   2.0.0 - 29.08.2012
 *
 * @param   string $html    The original image HTML.
 * @param   int    $id      The attachment ID.
 * @param   string $caption The image caption.
 * @param   string $title   The image title.
 * @param   string $align   The image alignment.
 * @param   string $url     The image URL.
 * @param   string $_size   The image size.
 * @param   string $_alt    The image alt text.
 *
 * @return  string The modified image HTML.
 */
function the_bootstrap_image_send_to_editor( $html, $id, $caption, $title, $align, $url, $_size, $_alt ) {
	if ( $url ) {
		$html = str_replace( '<a ', '<a class="thumbnail" ', $html );
	} else {
		$html = str_replace( 'class="', 'class="thumbnail ', $html );
	}

	return $html;
}
add_filter( 'image_send_to_editor', 'the_bootstrap_image_send_to_editor', 10, 8 );


/**
 * Adjusts content_width value for full-width and single image attachment
 * templates, and when there are no active widgets in the sidebar.
 *
 * @author  WordPress.org
 * @since   2.0.0 - 29.08.2012
 *
 * @return  void
 */
function the_bootstrap_content_width() {
	if ( is_attachment() ) {
		global $content_width;
		$content_width = 940;
	}
}
add_action( 'template_redirect', 'the_bootstrap_content_width' );


/**
 * Returns the Theme version string
 *
 * @author  Konstantin Obenland
 * @since   1.2.4 - 07.04.2012
 * @access  private
 *
 * @return  string  The Bootstrap version
 */
function _the_bootstrap_version() {
	return wp_get_theme()->get( 'Version' );
}

/**
 * Register custom taxonomies for projects.
 *
 * @since 1.0.0
 *
 * @return void
 */
function the_bootstrap_register_project_taxonomies() {
	// Topics taxonomy.
	register_taxonomy(
		'topic',
		array( 'project' ),
		array(
			'labels'            => array(
				'name'                       => _x( 'Topics', 'taxonomy general name', 'the-bootstrap' ),
				'singular_name'              => _x( 'Topic', 'taxonomy singular name', 'the-bootstrap' ),
				'search_items'               => __( 'Search Topics', 'the-bootstrap' ),
				'popular_items'              => __( 'Popular Topics', 'the-bootstrap' ),
				'all_items'                  => __( 'All Topics', 'the-bootstrap' ),
				'edit_item'                  => __( 'Edit Topic', 'the-bootstrap' ),
				'update_item'                => __( 'Update Topic', 'the-bootstrap' ),
				'add_new_item'               => __( 'Add New Topic', 'the-bootstrap' ),
				'new_item_name'              => __( 'New Topic Name', 'the-bootstrap' ),
				'separate_items_with_commas' => __( 'Separate topics with commas', 'the-bootstrap' ),
				'add_or_remove_items'        => __( 'Add or remove topics', 'the-bootstrap' ),
				'choose_from_most_used'      => __( 'Choose from most used topics', 'the-bootstrap' ),
				'menu_name'                  => __( 'Topics', 'the-bootstrap' ),
			),
			'public'            => true,
			'hierarchical'      => false,
			'show_ui'           => true,
			'show_admin_column' => true,
			'show_in_nav_menus' => true,
			'show_tagcloud'     => true,
			'rewrite'           => true,
			'query_var'         => true,
		)
	);

	// Schools taxonomy.
	register_taxonomy(
		'schools',
		array( 'project' ),
		array(
			'labels'            => array(
				'name'              => _x( 'Schools', 'taxonomy general name', 'the-bootstrap' ),
				'singular_name'     => _x( 'School', 'taxonomy singular name', 'the-bootstrap' ),
				'search_items'      => __( 'Search Schools', 'the-bootstrap' ),
				'all_items'         => __( 'All Schools', 'the-bootstrap' ),
				'parent_item'       => __( 'Parent School', 'the-bootstrap' ),
				'parent_item_colon' => __( 'Parent School:', 'the-bootstrap' ),
				'edit_item'         => __( 'Edit School', 'the-bootstrap' ),
				'update_item'       => __( 'Update School', 'the-bootstrap' ),
				'add_new_item'      => __( 'Add New School', 'the-bootstrap' ),
				'new_item_name'     => __( 'New School Name', 'the-bootstrap' ),
				'menu_name'         => __( 'Schools', 'the-bootstrap' ),
			),
			'public'            => true,
			'hierarchical'      => true,
			'show_ui'           => true,
			'show_admin_column' => true,
			'show_in_nav_menus' => true,
			'show_tagcloud'     => true,
			'rewrite'           => true,
			'query_var'         => true,
		)
	);

	// Professors taxonomy.
	register_taxonomy(
		'professors',
		array( 'project' ),
		array(
			'labels'            => array(
				'name'          => _x( 'Professors', 'taxonomy general name', 'the-bootstrap' ),
				'singular_name' => _x( 'Professor', 'taxonomy singular name', 'the-bootstrap' ),
				'search_items'  => __( 'Search Professors', 'the-bootstrap' ),
				'all_items'     => __( 'All Professors', 'the-bootstrap' ),
				'edit_item'     => __( 'Edit Professor', 'the-bootstrap' ),
				'update_item'   => __( 'Update Professor', 'the-bootstrap' ),
				'add_new_item'  => __( 'Add New Professor', 'the-bootstrap' ),
				'new_item_name' => __( 'New Professor Name', 'the-bootstrap' ),
				'menu_name'     => __( 'Professors', 'the-bootstrap' ),
			),
			'public'            => true,
			'hierarchical'      => true,
			'show_ui'           => true,
			'show_admin_column' => true,
			'show_in_nav_menus' => true,
			'show_tagcloud'     => true,
			'rewrite'           => true,
			'query_var'         => true,
		)
	);

	// Courses taxonomy.
	register_taxonomy(
		'courses',
		array( 'project' ),
		array(
			'labels'            => array(
				'name'          => _x( 'Courses', 'taxonomy general name', 'the-bootstrap' ),
				'singular_name' => _x( 'Course', 'taxonomy singular name', 'the-bootstrap' ),
				'search_items'  => __( 'Search Courses', 'the-bootstrap' ),
				'all_items'     => __( 'All Courses', 'the-bootstrap' ),
				'edit_item'     => __( 'Edit Course', 'the-bootstrap' ),
				'update_item'   => __( 'Update Course', 'the-bootstrap' ),
				'add_new_item'  => __( 'Add New Course', 'the-bootstrap' ),
				'new_item_name' => __( 'New Course Name', 'the-bootstrap' ),
				'menu_name'     => __( 'Courses', 'the-bootstrap' ),
			),
			'public'            => true,
			'hierarchical'      => true,
			'show_ui'           => true,
			'show_admin_column' => true,
			'show_in_nav_menus' => true,
			'show_tagcloud'     => true,
			'rewrite'           => true,
			'query_var'         => true,
		)
	);

	// Semesters taxonomy.
	register_taxonomy(
		'semesters',
		array( 'project' ),
		array(
			'labels'            => array(
				'name'          => _x( 'Semesters', 'taxonomy general name', 'the-bootstrap' ),
				'singular_name' => _x( 'Semester', 'taxonomy singular name', 'the-bootstrap' ),
				'search_items'  => __( 'Search Semesters', 'the-bootstrap' ),
				'all_items'     => __( 'All Semesters', 'the-bootstrap' ),
				'edit_item'     => __( 'Edit Semester', 'the-bootstrap' ),
				'update_item'   => __( 'Update Semester', 'the-bootstrap' ),
				'add_new_item'  => __( 'Add New Semester', 'the-bootstrap' ),
				'new_item_name' => __( 'New Semester Name', 'the-bootstrap' ),
				'menu_name'     => __( 'Semesters', 'the-bootstrap' ),
			),
			'public'            => true,
			'hierarchical'      => true,
			'show_ui'           => true,
			'show_admin_column' => true,
			'show_in_nav_menus' => true,
			'show_tagcloud'     => true,
			'rewrite'           => true,
			'query_var'         => true,
		)
	);
}
add_action( 'init', 'the_bootstrap_register_project_taxonomies' );

/**
 * Register the Project custom post type.
 *
 * @since 1.0.0
 *
 * @return void
 */
function the_bootstrap_register_project_post_type() {
	register_post_type(
		'project',
		array(
			'labels'                => array(
				'name'                  => _x( 'Projects', 'post type general name', 'the-bootstrap' ),
				'singular_name'         => _x( 'Project', 'post type singular name', 'the-bootstrap' ),
				'add_new'               => _x( 'Add New', 'project', 'the-bootstrap' ),
				'add_new_item'          => __( 'Add New Project', 'the-bootstrap' ),
				'edit_item'             => __( 'Edit Project', 'the-bootstrap' ),
				'new_item'              => __( 'New Project', 'the-bootstrap' ),
				'all_items'             => __( 'All Projects', 'the-bootstrap' ),
				'view_item'             => __( 'View Project', 'the-bootstrap' ),
				'view_items'            => __( 'View Projects', 'the-bootstrap' ),
				'search_items'          => __( 'Search Projects', 'the-bootstrap' ),
				'not_found'             => __( 'No projects found', 'the-bootstrap' ),
				'not_found_in_trash'    => __( 'No projects found in Trash', 'the-bootstrap' ),
				'featured_image'        => __( 'Project Featured Image', 'the-bootstrap' ),
				'set_featured_image'    => __( 'Set project featured image', 'the-bootstrap' ),
				'remove_featured_image' => __( 'Remove project featured image', 'the-bootstrap' ),
				'use_featured_image'    => __( 'Use as project featured image', 'the-bootstrap' ),
				'archives'              => __( 'Project Archives', 'the-bootstrap' ),
				'insert_into_item'      => __( 'Insert into project', 'the-bootstrap' ),
				'uploaded_to_this_item' => __( 'Uploaded to this project', 'the-bootstrap' ),
				'filter_items_list'     => __( 'Filter projects list', 'the-bootstrap' ),
				'items_list_navigation' => __( 'Projects list navigation', 'the-bootstrap' ),
				'items_list'            => __( 'Projects list', 'the-bootstrap' ),
				'menu_name'             => __( 'Projects', 'the-bootstrap' ),
			),
			'description'           => __( 'Student civic engagement projects', 'the-bootstrap' ),
			'public'                => true,
			'publicly_queryable'    => true,
			'show_ui'               => true,
			'show_in_menu'          => true,
			'show_in_nav_menus'     => true,
			'show_in_admin_bar'     => true,
			'show_in_rest'          => true, // Enable block editor support.
			'rest_base'             => 'projects',
			'rest_controller_class' => 'WP_REST_Posts_Controller',
			'menu_position'         => 5,
			'menu_icon'             => 'dashicons-portfolio',
			'capability_type'       => 'post',
			'hierarchical'          => false,
			'supports'              => array(
				'title',
				'editor',
				'thumbnail',
				'excerpt',
				'comments',
				'custom-fields',
				'revisions',
			),
			'has_archive'           => true,
			'rewrite'               => array(
				'slug'       => 'project',
				'with_front' => false,
			),
			'query_var'             => true,
			'can_export'            => true,
			'delete_with_user'      => false,
			'taxonomies'            => array( 'schools', 'topic' ),
		)
	);
}
add_action( 'init', 'the_bootstrap_register_project_post_type' );

/**
 * Include custom post types in category and tag archives.
 *
 * @since 1.0.0
 *
 * @param array $request The original query request.
 *
 * @return array The modified query request.
 */
function the_bootstrap_include_custom_post_types_in_archives( $request ) {
	if ( isset( $request['category_name'] ) || isset( $request['tag'] ) ) {
		$request['post_type'] = 'any';
	}
	return $request;
}
add_filter( 'request', 'the_bootstrap_include_custom_post_types_in_archives' );


/**
 * Flush rewrite rules when theme is activated.
 * This replaces the performance-killing flush on every page load.
 *
 * @since 1.0.0
 *
 * @return void
 */
function the_bootstrap_flush_rewrite_rules_on_activation() {
	the_bootstrap_register_project_post_type();
	the_bootstrap_register_project_taxonomies();
	flush_rewrite_rules();
}
add_action( 'after_switch_theme', 'the_bootstrap_flush_rewrite_rules_on_activation' );


/**
 * Add custom favicon and app icons.
 *
 * @since 1.0.0
 *
 * @return void
 */
function the_bootstrap_add_favicon() {
	$template_url = get_template_directory_uri();

	echo '<!-- Favicon and App Icons -->' . "\n";
	echo '<link rel="icon" type="image/svg+xml" href="' . esc_url( $template_url . '/favicon.svg' ) . '">' . "\n";
	echo '<link rel="alternate icon" type="image/svg+xml" href="' . esc_url( $template_url . '/favicon-simple.svg' ) . '">' . "\n";
	echo '<link rel="manifest" href="' . esc_url( $template_url . '/site.webmanifest' ) . '">' . "\n";
	echo '<meta name="theme-color" content="#fd7e14">' . "\n";
	echo '<meta name="msapplication-TileColor" content="#fd7e14">' . "\n";
}
add_action( 'wp_head', 'the_bootstrap_add_favicon', 1 );

/*
End of file functions.php
*/

/*
Location: ./wp-content/themes/the-bootstrap/functions.php
*/
