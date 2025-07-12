// Debug CSS application on mobile viewport
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

		// Wait for lead-home element
		await page.waitForSelector( '.lead-home', { timeout: 10000 } );

		// Get all CSS rules that apply to lead-home
		const cssDebug = await page.evaluate( () => {
			const leadHome = document.querySelector( '.lead-home' );
			if ( ! leadHome ) {
				return { error: 'Element not found' };
			}

			// Get computed styles
			const computed = window.getComputedStyle( leadHome );

			// Get all stylesheets and rules that might apply
			const allRules = [];
			for ( const sheet of document.styleSheets ) {
				try {
					if ( sheet.cssRules ) {
						for ( const rule of sheet.cssRules ) {
							if (
								rule.selectorText &&
								rule.selectorText.includes( 'lead-home' )
							) {
								allRules.push( {
									selector: rule.selectorText,
									cssText: rule.cssText,
									type: rule.type,
								} );
							}
							// Check media rules too
							if ( rule.type === 4 && rule.cssRules ) {
								// MediaRule
								for ( const mediaRule of rule.cssRules ) {
									if (
										mediaRule.selectorText &&
										mediaRule.selectorText.includes(
											'lead-home'
										)
									) {
										allRules.push( {
											selector: mediaRule.selectorText,
											cssText: mediaRule.cssText,
											media:
												rule.conditionText ||
												rule.media.mediaText,
											type: mediaRule.type,
										} );
									}
								}
							}
						}
					}
				} catch ( e ) {
					// CORS or other access error
				}
			}

			return {
				computed: {
					height: computed.height,
					minHeight: computed.minHeight,
					display: computed.display,
					padding: computed.padding,
				},
				matchingRules: allRules,
				viewport: {
					width: window.innerWidth,
					height: window.innerHeight,
				},
			};
		} );

		console.log( 'CSS DEBUG INFO:' );
		console.log( 'Computed styles:', cssDebug.computed );
		console.log( 'Viewport:', cssDebug.viewport );
		console.log( '\nMatching CSS Rules:' );
		cssDebug.matchingRules.forEach( ( rule, i ) => {
			console.log(
				`${ i + 1 }. ${ rule.selector }${
					rule.media ? ` [${ rule.media }]` : ''
				}`
			);
			console.log( `   ${ rule.cssText }` );
			console.log( '' );
		} );

		await browser.close();
	} catch ( error ) {
		console.error( 'Error:', error.message );
	}
} )();
