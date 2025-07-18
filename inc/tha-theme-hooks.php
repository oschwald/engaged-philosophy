<?php
/**
 * Theme Hook Alliance hook stub list.
 *
 * @package      themehookalliance
 * @version      1.0-draft
 * @since        1.0-draft
 * @license      http://www.gnu.org/licenses/old-licenses/gpl-2.0.html GNU General Public License, v2 (or newer)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 */

/**
 * Define the version of THA support, in case that becomes useful down the road.
 */
define( 'THA_HOOKS_VERSION', '1.0-draft' );

/**
 * Themes and Plugins can check for tha_hooks using current_theme_supports( 'tha_hooks', $hook )
 * to determine whether a theme declares itself to support this specific hook type.
 *
 * Example:
 * <code>
 *      // Declare support for all hook types.
 *      add_theme_support( 'tha_hooks', array( 'all' ) );
 *
 *      // Declare support for certain hook types only.
 *      add_theme_support( 'tha_hooks', array( 'header', 'content', 'footer' ) );
 * </code>
 */
add_theme_support(
	'tha_hooks',
	array(

		/**
		 * As a Theme developer, use the 'all' parameter, to declare support for all
		 * hook types.
		 * Please make sure you then actually reference all the hooks in this file,
		 * plugin developers depend on it!
		 */
		'all',

		/**
		 * Themes can also choose to only support certain hook types.
		 * Please make sure you then actually reference all the hooks in this type
		 * family.
		 *
		 * When the 'all' parameter was set, specific hook types do not need to be
		 * added explicitly.
		 */
		'head',
		'header',
		'content',
		'entry',
		'comments',
		'sidebars',
		'sidebar',
		'footer',

	/**
	 * If/when WordPress Core implements similar methodology, Themes and Plugins
	 * will be able to check whether the version of THA supplied by the theme
	 * supports Core hooks.
	 */
	// 'core'.
	)
);

/**
 * Determines, whether the specific hook type is actually supported.
 *
 * Plugin developers should always check for the support of a <strong>specific</strong>
 * hook type before hooking a callback function to a hook of this type.
 *
 * Example:
 * <code>
 *      if ( current_theme_supports( 'tha_hooks', 'header' ) )
 *          add_action( 'tha_head_top', 'prefix_header_top' );
 * </code>
 *
 * @param bool  $supported true.
 * @param array $args The hook type being checked.
 * @param array $registered All registered hook types.
 *
 * @return bool
 */
function tha_current_theme_supports( $supported, $args, $registered ) {
	return in_array( $args[0], $registered[0], true ) || in_array( 'all', $registered[0], true );
}
add_filter( 'current_theme_supports-tha_hooks', 'tha_current_theme_supports', 10, 3 );

/**
 * HTML <head> hooks
 *
 * $tha_supports[] = 'head';
 */

/**
 * Fires at the top of the HTML head section.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_head_top() {
	do_action( 'tha_head_top' );
}

/**
 * Fires at the bottom of the HTML head section.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_head_bottom() {
	do_action( 'tha_head_bottom' );
}


/**
 * Semantic <header> hooks
 *
 * $tha_supports[] = 'header';
 */

/**
 * Fires before the semantic header element.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_header_before() {
	do_action( 'tha_header_before' );
}

/**
 * Fires after the semantic header element.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_header_after() {
	do_action( 'tha_header_after' );
}

/**
 * Fires at the top of the semantic header element.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_header_top() {
	do_action( 'tha_header_top' );
}

/**
 * Fires at the bottom of the semantic header element.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_header_bottom() {
	do_action( 'tha_header_bottom' );
}

/**
 * Semantic <content> hooks
 *
 * $tha_supports[] = 'content';
 */

/**
 * Fires before the semantic content element.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_content_before() {
	do_action( 'tha_content_before' );
}

/**
 * Fires after the semantic content element.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_content_after() {
	do_action( 'tha_content_after' );
}

/**
 * Fires at the top of the semantic content element.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_content_top() {
	do_action( 'tha_content_top' );
}

/**
 * Fires at the bottom of the semantic content element.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_content_bottom() {
	do_action( 'tha_content_bottom' );
}

/**
 * Semantic <entry> hooks
 *
 * $tha_supports[] = 'entry';
 */

/**
 * Fires before the semantic entry element.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_entry_before() {
	do_action( 'tha_entry_before' );
}

/**
 * Fires after the semantic entry element.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_entry_after() {
	do_action( 'tha_entry_after' );
}

/**
 * Fires at the top of the semantic entry element.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_entry_top() {
	do_action( 'tha_entry_top' );
}

/**
 * Fires at the bottom of the semantic entry element.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_entry_bottom() {
	do_action( 'tha_entry_bottom' );
}

/**
 * Comments block hooks
 *
 * $tha_supports[] = 'comments';
 */

/**
 * Fires before the comments block.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_comments_before() {
	do_action( 'tha_comments_before' );
}

/**
 * Fires after the comments block.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_comments_after() {
	do_action( 'tha_comments_after' );
}

/**
 * Semantic <sidebar> hooks
 *
 * $tha_supports[] = 'sidebar';
 */

/**
 * Fires before the sidebar area.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_sidebars_before() {
	do_action( 'tha_sidebars_before' );
}

/**
 * Fires after the sidebar area.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_sidebars_after() {
	do_action( 'tha_sidebars_after' );
}

/**
 * Fires at the top of the sidebar.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_sidebar_top() {
	do_action( 'tha_sidebar_top' );
}

/**
 * Fires at the bottom of the sidebar.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_sidebar_bottom() {
	do_action( 'tha_sidebar_bottom' );
}

/**
 * Semantic <footer> hooks
 *
 * $tha_supports[] = 'footer';
 */

/**
 * Fires before the semantic footer element.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_footer_before() {
	do_action( 'tha_footer_before' );
}

/**
 * Fires after the semantic footer element.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_footer_after() {
	do_action( 'tha_footer_after' );
}

/**
 * Fires at the top of the semantic footer element.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_footer_top() {
	do_action( 'tha_footer_top' );
}

/**
 * Fires at the bottom of the semantic footer element.
 *
 * @since 1.0.0
 *
 * @return void
 */
function tha_footer_bottom() {
	do_action( 'tha_footer_bottom' );
}
