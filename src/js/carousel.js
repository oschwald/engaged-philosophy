/**
 * Bootstrap Carousel Initialization
 * Handles carousel initialization across the theme
 */

document.addEventListener( 'DOMContentLoaded', function () {
	const carousel = document.getElementById( 'projects_carousel' );
	if ( carousel ) {
		// Initialize Bootstrap 5 carousel with custom interval for home page
		// Use longer interval on home page, auto-initialize on other pages
		const isHomePage =
			document.body.classList.contains( 'home' ) ||
			document.querySelector( '.home' ) !== null;

		if ( isHomePage ) {
			new bootstrap.Carousel( carousel, {
				interval: 30000, // 30 seconds on home page
			} );
		} else {
			// Bootstrap 5 carousel auto-initializes with default settings
			// No manual initialization needed for other pages
		}
	}
} );
