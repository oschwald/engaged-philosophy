const puppeteer = require( 'puppeteer' );

( async () => {
	const browser = await puppeteer.launch();
	const page = await browser.newPage();

	// Test mobile viewport
	await page.setViewport( { width: 375, height: 667 } );
	await page.goto( 'http://localhost:8080' );
	await page.waitForSelector( '.lead-home' );

	const mobileMeasurements = await page.evaluate( () => {
		const leadHome = document.querySelector( '.lead-home' );
		if ( ! leadHome ) {
			return null;
		}

		const rect = leadHome.getBoundingClientRect();
		const computedStyle = window.getComputedStyle( leadHome );

		return {
			actualHeight: rect.height,
			contentHeight: leadHome.scrollHeight,
			computedHeight: computedStyle.height,
			computedMinHeight: computedStyle.minHeight,
			computedDisplay: computedStyle.display,
			computedFlexDirection: computedStyle.flexDirection,
			padding: {
				top: computedStyle.paddingTop,
				bottom: computedStyle.paddingBottom,
				left: computedStyle.paddingLeft,
				right: computedStyle.paddingRight,
			},
		};
	} );

	console.log( '=== MOBILE (375px) MEASUREMENTS ===' );
	console.log( JSON.stringify( mobileMeasurements, null, 2 ) );

	// Test desktop viewport for comparison
	await page.setViewport( { width: 1400, height: 800 } );
	await page.reload();
	await page.waitForSelector( '.lead-home' );

	const desktopMeasurements = await page.evaluate( () => {
		const leadHome = document.querySelector( '.lead-home' );
		if ( ! leadHome ) {
			return null;
		}

		const rect = leadHome.getBoundingClientRect();
		const computedStyle = window.getComputedStyle( leadHome );

		return {
			actualHeight: rect.height,
			contentHeight: leadHome.scrollHeight,
			computedHeight: computedStyle.height,
			computedMinHeight: computedStyle.minHeight,
			computedDisplay: computedStyle.display,
			computedFlexDirection: computedStyle.flexDirection,
			padding: {
				top: computedStyle.paddingTop,
				bottom: computedStyle.paddingBottom,
				left: computedStyle.paddingLeft,
				right: computedStyle.paddingRight,
			},
		};
	} );

	console.log( '\n=== DESKTOP (1400px) MEASUREMENTS ===' );
	console.log( JSON.stringify( desktopMeasurements, null, 2 ) );

	await browser.close();
} )();
