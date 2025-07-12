// Simple mobile viewport test using basic browser automation
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

		// Wait for lead-home element and get measurements
		await page.waitForSelector( '.lead-home', { timeout: 10000 } );

		const measurements = await page.evaluate( () => {
			const leadHome = document.querySelector( '.lead-home' );
			if ( ! leadHome ) {
				return { error: 'Element not found' };
			}

			const rect = leadHome.getBoundingClientRect();
			const styles = window.getComputedStyle( leadHome );

			return {
				actualHeight: Math.round( rect.height ),
				computedHeight: styles.height,
				computedMinHeight: styles.minHeight,
				computedPadding: styles.padding,
				computedDisplay: styles.display,
				viewport: {
					width: window.innerWidth,
					height: window.innerHeight,
				},
			};
		} );

		console.log( 'MOBILE MEASUREMENTS:' );
		console.log( JSON.stringify( measurements, null, 2 ) );

		// Check if height is auto and not fixed
		const isFixed =
			measurements.computedHeight &&
			measurements.computedHeight !== 'auto';
		console.log(
			`\nHEIGHT STATUS: ${ isFixed ? 'FIXED (PROBLEM)' : 'AUTO (GOOD)' }`
		);

		await browser.close();
	} catch ( error ) {
		console.error( 'Error:', error.message );
	}
} )();
