/**
 * Custom Header JavaScript
 * Handles header-specific functionality
 */

document.addEventListener( 'DOMContentLoaded', function () {
	// Handle site name link click prevention
	const siteNameLink = document.getElementById( 'name' );
	if ( siteNameLink ) {
		siteNameLink.addEventListener( 'click', function ( e ) {
			e.preventDefault();
			return false;
		} );
	}
} );
