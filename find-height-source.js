// Find the exact source of the 407px height
const puppeteer = require( 'puppeteer' );

( async () => {
	try {
		const browser = await puppeteer.launch( {
			headless: true,
			args: [ '--no-sandbox', '--disable-setuid-sandbox' ],
		} );
		const page = await browser.newPage();

		// Set mobile viewport
		await page.setViewport( { width: 375, height: 667 } );
		await page.goto( 'http://localhost:8080', {
			waitUntil: 'networkidle0',
		} );

		// Get exact CSS source for height property
		const heightSource = await page.evaluate( () => {
			const leadHome = document.querySelector( '.lead-home' );
			if ( ! leadHome ) {
				return { error: 'Element not found' };
			}

			// Try to find the exact rule setting height
			const allComputedStyles = window.getComputedStyle( leadHome );

			// Create a test element to compare
			const testDiv = document.createElement( 'div' );
			testDiv.className = 'lead-home';
			testDiv.style.cssText =
				'height: auto !important; min-height: 0 !important; display: block !important;';
			document.body.appendChild( testDiv );

			const testStyles = window.getComputedStyle( testDiv );
			document.body.removeChild( testDiv );

			// Try to manually override with higher specificity
			const originalClass = leadHome.className;
			leadHome.className = leadHome.className + ' mobile-override-test';

			// Add a style tag with very high specificity
			const styleTag = document.createElement( 'style' );
			styleTag.innerHTML = `
        .lead-home.mobile-override-test {
          height: auto !important;
          min-height: 0 !important;
        }
      `;
			document.head.appendChild( styleTag );

			const overrideStyles = window.getComputedStyle( leadHome );
			const overrideRect = leadHome.getBoundingClientRect();

			// Cleanup
			leadHome.className = originalClass;
			document.head.removeChild( styleTag );

			return {
				original: {
					height: allComputedStyles.height,
					minHeight: allComputedStyles.minHeight,
					display: allComputedStyles.display,
					boxSizing: allComputedStyles.boxSizing,
					actualHeight: Math.round(
						leadHome.getBoundingClientRect().height
					),
				},
				test: {
					height: testStyles.height,
					minHeight: testStyles.minHeight,
				},
				override: {
					height: overrideStyles.height,
					minHeight: overrideStyles.minHeight,
					actualHeight: Math.round( overrideRect.height ),
				},
			};
		} );

		console.log( 'HEIGHT SOURCE ANALYSIS:' );
		console.log( JSON.stringify( heightSource, null, 2 ) );

		await browser.close();
	} catch ( error ) {
		console.error( 'Error:', error.message );
	}
} )();
