// Theme-specific JavaScript functionality
// Migrated from original Bootstrap 2 theme

// Handle responsive navigation
function initResponsiveNav() {
	const navToggle = document.querySelector( '.navbar-toggler' );
	const navCollapse = document.querySelector( '.navbar-collapse' );

	if ( navToggle && navCollapse ) {
		navToggle.addEventListener( 'click', function () {
			navCollapse.classList.toggle( 'show' );
		} );
	}
}

// Carousel functionality is auto-initialized by Bootstrap 5

// Gallery functionality is handled by WordPress core and Bootstrap CSS

// Handle search functionality
function initSearch() {
	const searchForm = document.querySelector( '.form-search' );
	const searchInput = document.querySelector( '#s' );

	if ( searchForm && searchInput ) {
		// Add search enhancements here
	}
}

// Load Facebook SDK externally
function initFacebookSDK() {
	( function ( d, s, id ) {
		const fjs = d.getElementsByTagName( s )[ 0 ];
		if ( d.getElementById( id ) ) {
			return;
		}
		const js = d.createElement( s );
		js.id = id;
		js.src =
			'https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v2.0';
		fjs.parentNode.insertBefore( js, fjs );
	} )( document, 'script', 'facebook-jssdk' );
}

// Initialize all theme functionality
function initTheme() {
	initResponsiveNav();
	initSearch();
	initFacebookSDK();
}

// Initialize when DOM is ready
document.addEventListener( 'DOMContentLoaded', function () {
	initTheme();
} );

// Export for use in main index.js
export { initTheme };
