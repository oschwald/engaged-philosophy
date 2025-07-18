<?php
/**
 * Navigation menu functions
 *
 * @author      Konstantin Obenland
 * @package     The Bootstrap
 * @since       1.5.0 - 15.05.2012
 */

/**
 * Adds the active CSS class.
 *
 * @author  Konstantin Obenland
 * @since   1.5.0 - 15.05.2012
 *
 * @param   array $classes The default CSS class names for the menu item.
 *
 * @return  array The modified CSS class names.
 */
function the_bootstrap_nav_menu_css_class( $classes ) {
	if ( in_array( 'current-menu-item', $classes, true ) || in_array( 'current-menu-ancestor', $classes, true ) ) {
		$classes[] = 'active';
	}

	return $classes;
}
add_filter( 'nav_menu_css_class', 'the_bootstrap_nav_menu_css_class' );
