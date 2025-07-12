document.addEventListener( 'DOMContentLoaded', function () {
	wp.customize( 'blogname', function ( value ) {
		value.bind( function ( to ) {
			const element = document.querySelector( '#site-title span' );
			if ( element ) {
				element.innerHTML = to;
			}
		} );
	} );
	wp.customize( 'blogdescription', function ( value ) {
		value.bind( function ( to ) {
			const element = document.querySelector( '#site-description' );
			if ( element ) {
				element.innerHTML = to;
			}
		} );
	} );
	wp.customize(
		'the_bootstrap_theme_options[theme_layout]',
		function ( value ) {
			value.bind( function ( to ) {
				const body = document.querySelector( 'body' );
				if ( body ) {
					body.classList.remove(
						'content-sidebar',
						'sidebar-content'
					);
					body.classList.add( to );
				}
			} );
		}
	);
	wp.customize(
		'the_bootstrap_theme_options[navbar_site_name]',
		function ( value ) {
			value.bind( function ( to ) {
				const existingBrand =
					document.querySelector( 'span.navbar-brand' );
				if ( existingBrand ) {
					existingBrand.remove();
				}
				if ( to ) {
					const navbarCollapse =
						document.querySelector( '.navbar-collapse' );
					if ( navbarCollapse ) {
						const span = document.createElement( 'span' );
						span.className = 'navbar-brand';
						span.textContent = the_bootstrap_customize.sitename;
						navbarCollapse.parentNode.insertBefore(
							span,
							navbarCollapse
						);
					}
				}
			} );
		}
	);
	wp.customize(
		'the_bootstrap_theme_options[navbar_searchform]',
		function ( value ) {
			value.bind( function ( to ) {
				const navbarSearch = document.querySelector( '.navbar-search' );
				if ( navbarSearch ) {
					navbarSearch.remove();
				}
				if ( to ) {
					const navbarCollapse =
						document.querySelector( '.navbar-collapse' );
					if ( navbarCollapse ) {
						navbarCollapse.innerHTML +=
							the_bootstrap_customize.searchform;
					}
				}
			} );
		}
	);
	wp.customize(
		'the_bootstrap_theme_options[navbar_inverse]',
		function ( value ) {
			value.bind( function ( to ) {
				const navbar = document.querySelector( '.navbar' );
				if ( navbar ) {
					navbar.classList.remove( 'navbar-inverse' );
					if ( to ) {
						navbar.classList.add( 'navbar-inverse' );
					}
				}
			} );
		}
	);
	wp.customize(
		'the_bootstrap_theme_options[navbar_position]',
		function ( value ) {
			value.bind( function ( to ) {
				const navbar = document.querySelector( '.navbar' );
				const container = document.querySelector( 'body > .container' );
				if ( navbar ) {
					navbar.classList.remove( 'fixed-top', 'fixed-bottom' );
				}
				if ( container ) {
					container.style.margin = '18px auto';
					if ( 'static' != to && navbar ) {
						navbar.classList.add( to );
						const margin =
							'fixed-top' == to ? 'margin-top' : 'margin-bottom';
						container.style[ margin ] = '58px';
					}
				}
			} );
		}
	);
} );
