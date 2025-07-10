<?php
/** nav-menu-walker.php
 *
 * @author		Konstantin Obenland
 * @package		The Bootstrap
 * @since		1.5.0 - 15.05.2012
 */


class The_Bootstrap_Nav_Walker extends Walker_Nav_Menu {

	/**
	 * @see Walker_Nav_Menu::start_lvl()
	 */
	function start_lvl( &$output, $depth = 0, $args = null ) {
		$output .= "\n<ul class=\"dropdown-menu\">\n";
	}

	/**
	 * @see Walker_Nav_Menu::start_el()
	 */
	function start_el( &$output, $data_object, $depth = 0, $args = null, $current_object_id = 0 ) {
		global $wp_query;
		$item = $data_object;
		
		$indent = ( $depth ) ? str_repeat( "\t", $depth ) : '';
		$li_attributes = $class_names = $value = '';
		$classes = empty( $item->classes ) ? array() : (array) $item->classes;
		$classes[] = 'menu-item-' . $item->ID;
		$classes[] = 'nav-item';

		if ( $args->has_children ) {
			$classes[] = 'dropdown';
			if ( $depth > 0 ) {
				$classes[] = 'dropend';
			}
		}

		$class_names = join( ' ', apply_filters( 'nav_menu_css_class', array_filter( $classes ), $item, $args ) );
		$class_names = $class_names ? ' class="' . esc_attr( $class_names ) . '"' : '';

		$id = apply_filters( 'nav_menu_item_id', 'menu-item-'. $item->ID, $item, $args );
		$id = $id ? ' id="' . esc_attr( $id ) . '"' : '';

		$output .= $indent . '<li' . $id . $value . $class_names . $li_attributes . '>';

		$attributes	=	$item->attr_title	? ' title="'  . esc_attr( $item->attr_title ) .'"' : '';
		$attributes	.=	$item->target		? ' target="' . esc_attr( $item->target     ) .'"' : '';
		$attributes	.=	$item->xfn			? ' rel="'    . esc_attr( $item->xfn        ) .'"' : '';
		$attributes	.=	$item->url			? ' href="'   . esc_attr( $item->url        ) .'"' : '';
		if ( $args->has_children ) {
			if ( $depth > 0 ) {
				$attributes .= ' class="dropdown-item dropdown-toggle" data-bs-toggle="dropdown"';
			} else {
				$attributes .= ' class="nav-link dropdown-toggle" data-bs-toggle="dropdown"';
			}
		} else {
			$attributes .= ( $depth > 0 ) ? ' class="dropdown-item"' : ' class="nav-link"';
		}

		$item_output	=	$args->before . '<a' . $attributes . '>';
		$item_output	.=	$args->link_before . apply_filters( 'the_title', $item->title, $item->ID ) . $args->link_after;
		$item_output	.=	( $args->has_children && 1 > $depth ) ? '' : '';
		$item_output	.=	'</a>' . $args->after;

		$output .= apply_filters( 'walker_nav_menu_start_el', $item_output, $item, $depth, $args );
	}

	/**
	 * @see Walker::display_element()
	 */
	function display_element( $element, &$children_elements, $max_depth, $depth = 0, $args, &$output ) {

		if ( ! $element )
			return;

		$id_field = $this->db_fields['id'];

		//display this element
		if ( is_array( $args[0] ) )
			$args[0]['has_children'] = (bool) ( ! empty( $children_elements[$element->$id_field] ) && $depth != $max_depth - 1 );
		elseif ( is_object(  $args[0] ) )
			$args[0]->has_children = (bool) ( ! empty( $children_elements[$element->$id_field] ) && $depth != $max_depth - 1 );

		$cb_args = array_merge( array( &$output, $element, $depth ), $args );
		call_user_func_array( array( $this, 'start_el' ), $cb_args );

		$id = $element->$id_field;

		// descend only when the depth is right and there are childrens for this element
		if ( ( $max_depth == 0 || $max_depth > $depth+1 ) && isset( $children_elements[$id] ) ) {

			foreach ( $children_elements[ $id ] as $child ) {

				if ( ! isset( $newlevel ) ) {
					$newlevel = true;
					//start the child delimiter
					$cb_args = array_merge( array( &$output, $depth ), $args );
					call_user_func_array( array( $this, 'start_lvl' ), $cb_args );
				}
				$this->display_element( $child, $children_elements, $max_depth, $depth + 1, $args, $output );
			}
			unset( $children_elements[ $id ] );
		}

		if ( isset( $newlevel ) && $newlevel ) {
			//end the child delimiter
			$cb_args = array_merge( array( &$output, $depth ), $args );
			call_user_func_array( array( $this, 'end_lvl' ), $cb_args );
		}

		//end this element
		$cb_args = array_merge( array( &$output, $element, $depth ), $args );
		call_user_func_array( array( $this, 'end_el' ), $cb_args );
	}
}


/**
 * Adds the active CSS class
 *
 * @author	Konstantin Obenland
 * @since	1.5.0 - 15.05.2012
 *
 * @param	array	$classes	Default class names
 *
 * @return	array
 */
function the_bootstrap_nav_menu_css_class( $classes ) {
	if ( in_array('current-menu-item', $classes ) || in_array( 'current-menu-ancestor', $classes ) )
		$classes[]	=	'active';

	return $classes;
}
add_filter( 'nav_menu_css_class', 'the_bootstrap_nav_menu_css_class' );


/* End of file nav-menu-walker.php */
/* Location: ./wp-content/themes/the-bootstrap/inc/nav-menu-walker.php */