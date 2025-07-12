<?php
/**
 * Navigation menu walker class file
 *
 * @author      Konstantin Obenland
 * @package     The Bootstrap
 * @since       1.5.0 - 15.05.2012
 */

/**
 * The Bootstrap Nav Walker class
 *
 * @author      Konstantin Obenland
 * @package     The Bootstrap
 * @since       1.5.0 - 15.05.2012
 */
class The_Bootstrap_Nav_Walker extends Walker_Nav_Menu {

	/**
	 * Start the list before the elements are added.
	 *
	 * @see Walker_Nav_Menu::start_lvl()
	 * @since 1.5.0
	 *
	 * @param string $output Used to append additional content (passed by reference).
	 * @param int    $depth  Depth of menu item. Used for padding.
	 * @param object $args   An object of wp_nav_menu() arguments.
	 *
	 * @return void
	 */
	public function start_lvl( &$output, $depth = 0, $args = null ) {
		$output .= "\n<ul class=\"dropdown-menu\">\n";
	}

	/**
	 * Start the element output.
	 *
	 * @see Walker_Nav_Menu::start_el()
	 * @since 1.5.0
	 *
	 * @param string $output            Used to append additional content (passed by reference).
	 * @param object $data_object       The data object.
	 * @param int    $depth             Depth of menu item. Used for padding.
	 * @param object $args              An object of wp_nav_menu() arguments.
	 * @param int    $current_object_id ID of the current menu item.
	 *
	 * @return void
	 */
	public function start_el( &$output, $data_object, $depth = 0, $args = null, $current_object_id = 0 ) {
		global $wp_query;
		$item = $data_object;

		$indent        = ( $depth ) ? str_repeat( "\t", $depth ) : '';
		$li_attributes = '';
		$class_names   = '';
		$value         = '';
		$classes       = empty( $item->classes ) ? array() : (array) $item->classes;
		$classes[]     = 'menu-item-' . $item->ID;
		$classes[]     = 'nav-item';

		if ( $args->has_children ) {
			$classes[] = 'dropdown';
			if ( $depth > 0 ) {
				$classes[] = 'dropend';
			}
		}

		$class_names = join( ' ', apply_filters( 'nav_menu_css_class', array_filter( $classes ), $item, $args ) );
		$class_names = $class_names ? ' class="' . esc_attr( $class_names ) . '"' : '';

		$id = apply_filters( 'nav_menu_item_id', 'menu-item-' . $item->ID, $item, $args );
		$id = $id ? ' id="' . esc_attr( $id ) . '"' : '';

		$output .= $indent . '<li' . $id . $value . $class_names . $li_attributes . '>';

		$attributes  = $item->attr_title ? ' title="' . esc_attr( $item->attr_title ) . '"' : '';
		$attributes .= $item->target ? ' target="' . esc_attr( $item->target ) . '"' : '';
		$attributes .= $item->xfn ? ' rel="' . esc_attr( $item->xfn ) . '"' : '';

		if ( $args->has_children ) {
			// For dropdown toggles, use # to prevent navigation.
			$attributes .= ' href="#"';
			if ( $depth > 0 ) {
				$attributes .= ' class="dropdown-item dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false"';
			} else {
				$attributes .= ' class="nav-link dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false" aria-haspopup="true"';
			}
		} else {
			// For regular menu items, use the actual URL.
			$attributes .= $item->url ? ' href="' . esc_attr( $item->url ) . '"' : '';
			$attributes .= ( $depth > 0 ) ? ' class="dropdown-item"' : ' class="nav-link"';
		}

		$item_output  = $args->before . '<a' . $attributes . '>';
		$item_output .= $args->link_before . esc_html( apply_filters( 'the_title', $item->title, $item->ID ) ) . $args->link_after;
		$item_output .= ( $args->has_children && 1 > $depth ) ? '' : '';
		$item_output .= '</a>' . $args->after;

		$output .= apply_filters( 'walker_nav_menu_start_el', $item_output, $item, $depth, $args );
	}

	/**
	 * Display array of elements hierarchically.
	 *
	 * @see Walker::display_element()
	 * @since 1.5.0
	 *
	 * @param object $element           Menu item object.
	 * @param array  $children_elements Child elements (passed by reference).
	 * @param int    $max_depth         Maximum depth allowed.
	 * @param int    $depth             Depth of current element.
	 * @param array  $args              Arguments for display.
	 * @param string $output            Used to append additional content (passed by reference).
	 *
	 * @return void
	 */
	public function display_element( $element, &$children_elements, $max_depth, $depth, $args, &$output ) {

		if ( ! $element ) {
			return;
		}

		$id_field = $this->db_fields['id'];

		// Display this element.
		if ( is_array( $args[0] ) ) {
			$args[0]['has_children'] = (bool) ( ! empty( $children_elements[ $element->$id_field ] ) && $depth !== $max_depth - 1 );
		} elseif ( is_object( $args[0] ) ) {
			$args[0]->has_children = (bool) ( ! empty( $children_elements[ $element->$id_field ] ) && $depth !== $max_depth - 1 );
		}

		$cb_args = array_merge( array( &$output, $element, $depth ), $args );
		call_user_func_array( array( $this, 'start_el' ), $cb_args );

		$id = $element->$id_field;

		// Descend only when the depth is right and there are childrens for this element.
		if ( ( 0 === $max_depth || $max_depth > $depth + 1 ) && isset( $children_elements[ $id ] ) ) {

			foreach ( $children_elements[ $id ] as $child ) {

				if ( ! isset( $newlevel ) ) {
					$newlevel = true;
					// Start the child delimiter.
					$cb_args = array_merge( array( &$output, $depth ), $args );
					call_user_func_array( array( $this, 'start_lvl' ), $cb_args );
				}
				$this->display_element( $child, $children_elements, $max_depth, $depth + 1, $args, $output );
			}
			unset( $children_elements[ $id ] );
		}

		if ( isset( $newlevel ) ) {
			// End the child delimiter.
			$cb_args = array_merge( array( &$output, $depth ), $args );
			call_user_func_array( array( $this, 'end_lvl' ), $cb_args );
		}

		// End this element.
		$cb_args = array_merge( array( &$output, $element, $depth ), $args );
		call_user_func_array( array( $this, 'end_el' ), $cb_args );
	}
}
