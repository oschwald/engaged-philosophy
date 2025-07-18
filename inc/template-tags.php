<?php
/** Template tags and functions
 *
 * Implementation of the Custom Header feature
 * http://codex.wordpress.org/Custom_Headers
 *
 * @author      Konstantin Obenland
 * @package     The Bootstrap
 * @since       1.2.4 - 07.04.2012
 */

if ( ! function_exists( 'the_bootstrap_content_nav' ) ) :
	/**
	 * Display navigation to next/previous pages when applicable.
	 *
	 * To be honest - I'm pretty proud of this function. Through a lot of trial and
	 * error, I was able to use a core WordPress function (paginate_links()) and
	 * adjust it in a way that the end result is a legitimate pagination.
	 * a pagination many developers buy (code) expensively with plugins like
	 * WP Pagenavi. No need! WordPress has it all!
	 *
	 * @author  Konstantin Obenland
	 * @since   1.0.0 - 05.02.2012
	 *
	 * @return  void
	 */
	function the_bootstrap_content_nav() {
		global $wp_query, $wp_rewrite;

		$paged = ( get_query_var( 'paged' ) ) ? intval( get_query_var( 'paged' ) ) : 1;

		$pagenum_link = html_entity_decode( get_pagenum_link() );
		$query_args   = array();
		$url_parts    = explode( '?', $pagenum_link );

		if ( isset( $url_parts[1] ) ) {
			wp_parse_str( $url_parts[1], $query_args );
		}
		$pagenum_link = remove_query_arg( array_keys( $query_args ), $pagenum_link );
		$pagenum_link = trailingslashit( $pagenum_link ) . '%_%';

		$format  = ( $wp_rewrite->using_index_permalinks() && ! strpos( $pagenum_link, 'index.php' ) ) ? 'index.php/' : '';
		$format .= $wp_rewrite->using_permalinks() ? user_trailingslashit( 'page/%#%', 'paged' ) : '?paged=%#%';

		$links = paginate_links(
			array(
				'base'      => $pagenum_link,
				'format'    => $format,
				'total'     => $wp_query->max_num_pages,
				'current'   => $paged,
				'mid_size'  => 3,
				'type'      => 'array',
				'prev_text' => '&laquo; Previous',
				'next_text' => 'Next &raquo;',
				'add_args'  => array_map( 'urlencode', $query_args ),
			)
		);

		if ( $links ) {
			echo '<nav aria-label="Page navigation"><ul class="pagination justify-content-center">';
			foreach ( $links as $link ) {
				if ( strpos( $link, 'current' ) !== false ) {
					echo '<li class="page-item active">' . str_replace( 'page-numbers current', 'page-link', $link ) . '</li>';
				} elseif ( strpos( $link, 'dots' ) !== false ) {
					echo '<li class="page-item disabled"><span class="page-link">' . wp_strip_all_tags( $link ) . '</span></li>';
				} else {
					echo '<li class="page-item">' . str_replace( 'page-numbers', 'page-link', $link ) . '</li>';
				}
			}
			echo '</ul></nav>';
		}
	}
endif;


if ( ! function_exists( 'the_bootstrap_comment_nav' ) ) :
	/**
	 * Display navigation to next/previous comments pages when applicable.
	 *
	 * @author  Konstantin Obenland
	 * @since   1.5.0 - 19.05.2012
	 *
	 * @return  void
	 */
	function the_bootstrap_comment_nav() {
		if ( get_comment_pages_count() > 1 && get_option( 'page_comments' ) ) : // Are there comments to navigate through?
			?>
	<nav class="comment-nav card card-body">
		<h1 class="assistive-text"><?php esc_html_e( 'Comment navigation', 'the-bootstrap' ); ?></h1>
		<div class="nav-previous float-start"><?php next_comments_link( __( '&larr; Newer Comments', 'the-bootstrap' ) ); ?></div>
		<div class="nav-next float-end"><?php previous_comments_link( __( 'Older Comments &rarr;', 'the-bootstrap' ) ); ?></div>
	</nav>
			<?php
		endif; // Check for comment navigation.
	}
endif;


if ( ! function_exists( 'the_bootstrap_posted_on' ) ) :
	/**
	 * Prints HTML with meta information for the current post-date/time and author,
	 * comment and edit link.
	 *
	 * @author  Konstantin Obenland
	 * @since   1.0.0 - 05.02.2012
	 *
	 * @return  void
	 */
	function the_bootstrap_posted_on() {
		printf(
			__( '<span class="sep">Posted on </span><a href="%1$s" title="%2$s" rel="bookmark"><time class="entry-date" datetime="%3$s" pubdate>%4$s</time></a><span class="by-author"> <span class="sep"> by </span> <span class="author vcard"><a class="url fn n" href="%5$s" title="%6$s" rel="author">%7$s</a></span></span>', 'the-bootstrap' ),
			esc_url( get_permalink() ),
			esc_attr( get_the_time() ),
			esc_attr( get_the_date( 'c' ) ),
			esc_html( get_the_date() ),
			esc_url( get_author_posts_url( (int) get_the_author_meta( 'ID' ) ) ),
			esc_attr( sprintf( __( 'View all posts by %s', 'the-bootstrap' ), get_the_author() ) ),
			esc_html( get_the_author() )
		);
		if ( comments_open() && ! post_password_required() ) {
			?>
		<span class="sep"> | </span>
		<span class="comments-link">
				<?php comments_popup_link( '<span class="leave-reply">' . __( 'Leave a reply', 'the-bootstrap' ) . '</span>', __( '<strong>1</strong> Reply', 'the-bootstrap' ), __( '<strong>%</strong> Replies', 'the-bootstrap' ) ); ?>
		</span>
				<?php
		}
		edit_post_link( __( 'Edit', 'the-bootstrap' ), '<span class="sep">&nbsp;</span><span class="edit-link label">', '</span>' );
	}
endif;


if ( ! function_exists( 'the_bootstrap_link_pages' ) ) :
	/**
	 * Displays page links for paginated posts.
	 *
	 * It's basically the wp_link_pages() function, altered to fit the Bootstrap
	 * markup needs for paginations (unordered list).
	 *
	 * @see     wp_link_pages()
	 *
	 * @author  Konstantin Obenland
	 * @since   1.1.0 - 09.03.2012
	 *
	 * @param   array $args Optional. Array of arguments for the pagination.
	 *
	 * @return  string The pagination HTML markup.
	 */
	function the_bootstrap_link_pages( $args = array() ) {
		wp_link_pages( array( 'echo' => 0 ) );
		$defaults = array(
			'next_or_number'   => 'number',
			'nextpagelink'     => __( 'Next page', 'the-bootstrap' ),
			'previouspagelink' => __( 'Previous page', 'the-bootstrap' ),
			'pagelink'         => '%',
			'echo'             => true,
		);

		$r = wp_parse_args( $args, $defaults );
		$r = apply_filters( 'the_bootstrap_link_pages_args', $r );

		$next_or_number   = $r['next_or_number'];
		$nextpagelink     = $r['nextpagelink'];
		$previouspagelink = $r['previouspagelink'];
		$pagelink         = $r['pagelink'];
		$echo             = $r['echo'];

		global $page, $numpages, $multipage, $more, $pagenow;

		$output = '';
		if ( $multipage ) {
			if ( 'number' === $next_or_number ) {
				$output .= '<nav class="pagination"><ul class="pagination"><li class="page-item"><span class="page-link">' . __( 'Pages:', 'the-bootstrap' ) . '</span></li>';
				for ( $i = 1; $i < ( $numpages + 1 ); $i++ ) {
					$j = str_replace( '%', (string) $i, $pagelink );
					if ( ( $page !== $i ) || ( ( ! $more ) && ( 1 !== $page ) ) ) {
						$output .= '<li class="page-item">' . _wp_link_page( $i ) . '<span class="page-link">' . $j . '</span></a></li>';
					}
					if ( $i === $page ) {
						$output .= '<li class="page-item active"><span class="page-link">' . $j . '</span></li>';
					}
				}
				$output .= '</ul></nav>';
			} elseif ( $more ) {
					$output .= '<nav class="pagination"><ul class="pagination"><li class="page-item"><span class="page-link">' . __( 'Pages:', 'the-bootstrap' ) . '</span></li>';
					$i       = $page - 1;
				if ( $i ) {
					$output .= '<li class="page-item">' . _wp_link_page( $i ) . '<span class="page-link">' . $previouspagelink . '</span></a></li>';
				}
					$i = $page + 1;
				if ( $i <= $numpages ) {
					$output .= '<li class="page-item">' . _wp_link_page( $i ) . '<span class="page-link">' . $nextpagelink . '</span></a></li>';
				}
					$output .= '</ul></nav>';
			}
		}

		if ( $echo ) {
			echo $output;
		}

		return $output;
	}
endif;


if ( ! function_exists( 'the_bootstrap_navbar_searchform' ) ) :
	/**
	 * Returns or echoes searchform markup, specifically for the navbar.
	 *
	 * @author  Konstantin Obenland
	 * @since   1.5.0 - 14.05.2012
	 *
	 * @param   bool $output Optional. Whether to echo the form. Default true.
	 *
	 * @return  string Returns form HTML, echoes when $output is true.
	 */
	function the_bootstrap_navbar_searchform( $output = true ) {
		$searchform = '	<form id="searchform" class="d-flex ms-auto" method="get" action="' . esc_url( home_url( '/' ) ) . '" role="search" aria-label="' . esc_attr__( 'Search the site', 'the-bootstrap' ) . '">
						<label for="s" class="visually-hidden">' . __( 'Search', 'the-bootstrap' ) . '</label>
						<input type="search" class="form-control" name="s" id="s" placeholder="' . esc_attr__( 'Search', 'the-bootstrap' ) . '" aria-label="' . esc_attr__( 'Search the site', 'the-bootstrap' ) . '">
						<button type="submit" class="btn btn-outline-secondary ms-1" aria-label="' . esc_attr__( 'Submit search', 'the-bootstrap' ) . '"><i class="bi bi-search"></i></button>
					</form>';

		if ( $output ) {
			echo $searchform;
		}

		return $searchform;
	}
endif;


if ( ! function_exists( 'the_bootstrap_navbar_class' ) ) :
	/**
	 * Adds The Bootstrap navbar classes.
	 *
	 * @author  WordPress.org
	 * @since   1.4.0 - 12.05.2012
	 *
	 * @return  void
	 */
	function the_bootstrap_navbar_class() {
		$classes = array( 'navbar', 'navbar-expand-lg' );

		if ( 'static' !== the_bootstrap_options()->navbar_position ) {
			$classes[] = the_bootstrap_options()->navbar_position;
		}

		if ( the_bootstrap_options()->navbar_inverse ) {
			$classes[] = 'navbar-dark';
			$classes[] = 'bg-dark';
		} else {
			$classes[] = 'navbar-light';
			$classes[] = 'bg-light';
		}

		apply_filters( 'the_bootstrap_navbar_classes', $classes );

		echo 'class="' . esc_attr( join( ' ', $classes ) ) . '"';
	}
endif;


if ( ! function_exists( 'the_bootstrap_comments_link' ) ) :
	/**
	 * Displays the link to the comments popup window for the current post ID.
	 *
	 * Is not meant to be displayed on single posts and pages. Should be used on
	 * lists of posts.
	 *
	 * @since   2.0.0 - 01.09.2012
	 *
	 * @param   string|false $zero      The string to display when no comments. Default false.
	 * @param   string|false $one       The string to display when only one comment is available. Default false.
	 * @param   string|false $more      The string to display when there are more than one comment. Default false.
	 * @param   string       $css_class The CSS class to use for comments. Default empty string.
	 * @param   string|false $none      The string to display when comments have been turned off. Default false.
	 *
	 * @return  void
	 */
	function the_bootstrap_comments_link( $zero = false, $one = false, $more = false, $css_class = '', $none = false ) {
		$number = get_comments_number();
		$class  = empty( $css_class ) ? '' : ' class="' . esc_attr( $css_class ) . '"';

		if ( false === $zero ) {
			$zero = __( 'No Comments' );
		}
		if ( false === $one ) {
			$one = __( '1 Comment' );
		}
		if ( false === $more ) {
			$more = __( '% Comments' );
		}
		if ( false === $none ) {
			$none = __( 'Comments Off' );
		}

		if ( 0 === $number && ! comments_open() && ! pings_open() ) {
			echo '<span' . $class . '>' . $none . '</span>';
			return;
		}

		if ( post_password_required() ) {
			echo '<span' . $class . '>' . __( 'Enter your password to view comments.' ) . '</span>';
			return;
		}

		if ( 1 < $number ) {
			$comments_number = str_replace( '%', number_format_i18n( $number ), $more );
		} else {
			$comments_number = ( 0 === $number ) ? $zero : $one;
		}

		$link = sprintf(
			'<a href="%1$s"%2$s%3s title="%4$s">%5$s</a>',
			( 0 === $number ) ? '#respond' : '#comments',
			$class,
			apply_filters( 'comments_popup_link_attributes', '' ),
			esc_attr( sprintf( __( 'Comment on %s' ), the_title_attribute( array( 'echo' => false ) ) ) ),
			apply_filters( 'comments_number', $comments_number, $number )
		);

		echo apply_filters( 'the_bootstrap_comments_link', $link, $zero, $one, $more, $css_class, $none );
	}
endif;

/*
End of file template-tags.php
*/

/*
Location: ./wp-content/themes/the-bootstrap/inc/template-tags.php
*/