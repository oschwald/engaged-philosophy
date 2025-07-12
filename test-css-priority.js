// Test CSS media query application directly
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

		// Test media queries directly
		const mediaTest = await page.evaluate( () => {
			const mobileQuery = window.matchMedia( '(max-width: 991px)' );
			const tabletQuery = window.matchMedia(
				'(min-width: 768px) and (max-width: 1199px)'
			);

			return {
				viewport: {
					width: window.innerWidth,
					height: window.innerHeight,
				},
				mobileQueryMatches: mobileQuery.matches,
				tabletQueryMatches: tabletQuery.matches,
				mobileQueryText: mobileQuery.media,
				tabletQueryText: tabletQuery.media,
			};
		} );

		console.log( 'MEDIA QUERY TEST:' );
		console.log( JSON.stringify( mediaTest, null, 2 ) );

		// Force apply styles manually to test CSS hierarchy
		const manualStyleTest = await page.evaluate( () => {
			const leadHome = document.querySelector( '.lead-home' );
			if ( ! leadHome ) {
				return { error: 'Element not found' };
			}

			// Temporarily set inline style to override everything
			const originalStyle = leadHome.style.cssText;
			leadHome.style.cssText = 'height: auto !important;';

			const rect = leadHome.getBoundingClientRect();
			const computedHeight = window.getComputedStyle( leadHome ).height;

			// Restore original style
			leadHome.style.cssText = originalStyle;

			return {
				manualOverrideHeight: Math.round( rect.height ),
				computedHeightWithOverride: computedHeight,
			};
		} );

		console.log( '\nMANUAL OVERRIDE TEST:' );
		console.log( JSON.stringify( manualStyleTest, null, 2 ) );

		await browser.close();
	} catch ( error ) {
		console.error( 'Error:', error.message );
	}
} )();
