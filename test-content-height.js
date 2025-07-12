// Test if height is from content or CSS
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

		// Test content vs CSS height
		const heightAnalysis = await page.evaluate( () => {
			const leadHome = document.querySelector( '.lead-home' );
			if ( ! leadHome ) {
				return { error: 'Element not found' };
			}

			const styles = window.getComputedStyle( leadHome );
			const rect = leadHome.getBoundingClientRect();

			// Get content dimensions
			const scrollHeight = leadHome.scrollHeight;
			const clientHeight = leadHome.clientHeight;
			const offsetHeight = leadHome.offsetHeight;

			// Test if removing all content changes height
			const originalHTML = leadHome.innerHTML;
			leadHome.innerHTML = '';
			const emptyRect = leadHome.getBoundingClientRect();
			const emptyStyles = window.getComputedStyle( leadHome );
			leadHome.innerHTML = originalHTML; // Restore content

			// Test if forcing different display changes height
			const originalDisplay = leadHome.style.display;
			leadHome.style.display = 'block';
			leadHome.style.height = 'auto';
			leadHome.style.minHeight = '0';
			const forcedRect = leadHome.getBoundingClientRect();
			const forcedStyles = window.getComputedStyle( leadHome );

			// Restore
			leadHome.style.display = originalDisplay;
			leadHome.style.height = '';
			leadHome.style.minHeight = '';

			return {
				original: {
					height: Math.round( rect.height ),
					computedHeight: styles.height,
					computedMinHeight: styles.minHeight,
					computedDisplay: styles.display,
					scrollHeight,
					clientHeight,
					offsetHeight,
				},
				empty: {
					height: Math.round( emptyRect.height ),
					computedHeight: emptyStyles.height,
					computedMinHeight: emptyStyles.minHeight,
				},
				forced: {
					height: Math.round( forcedRect.height ),
					computedHeight: forcedStyles.height,
					computedMinHeight: forcedStyles.minHeight,
					computedDisplay: forcedStyles.display,
				},
			};
		} );

		console.log( 'HEIGHT ANALYSIS:' );
		console.log( JSON.stringify( heightAnalysis, null, 2 ) );

		await browser.close();
	} catch ( error ) {
		console.error( 'Error:', error.message );
	}
} )();
