// Inspect ALL styles affecting the element
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

		// Inspect everything about the element
		const fullInspection = await page.evaluate( () => {
			const leadHome = document.querySelector( '.lead-home' );
			if ( ! leadHome ) {
				return { error: 'Element not found' };
			}

			return {
				// Element properties
				tagName: leadHome.tagName,
				id: leadHome.id,
				className: leadHome.className,
				inlineStyle: leadHome.style.cssText,

				// Attributes
				attributes: Array.from( leadHome.attributes ).map(
					( attr ) => ( {
						name: attr.name,
						value: attr.value,
					} )
				),

				// Parent information
				parentElement: leadHome.parentElement
					? {
							tagName: leadHome.parentElement.tagName,
							className: leadHome.parentElement.className,
							id: leadHome.parentElement.id,
					  }
					: null,

				// All style properties that could affect height
				computedStyles: {
					height: window.getComputedStyle( leadHome ).height,
					minHeight: window.getComputedStyle( leadHome ).minHeight,
					maxHeight: window.getComputedStyle( leadHome ).maxHeight,
					lineHeight: window.getComputedStyle( leadHome ).lineHeight,
					padding: window.getComputedStyle( leadHome ).padding,
					border: window.getComputedStyle( leadHome ).border,
					margin: window.getComputedStyle( leadHome ).margin,
					boxSizing: window.getComputedStyle( leadHome ).boxSizing,
					display: window.getComputedStyle( leadHome ).display,
					position: window.getComputedStyle( leadHome ).position,
					flexDirection:
						window.getComputedStyle( leadHome ).flexDirection,
					alignItems: window.getComputedStyle( leadHome ).alignItems,
					justifyContent:
						window.getComputedStyle( leadHome ).justifyContent,
				},

				// Content info
				innerHTML: leadHome.innerHTML.substring( 0, 200 ) + '...',
				textContent: leadHome.textContent.substring( 0, 200 ) + '...',

				// Measurements
				measurements: {
					offsetHeight: leadHome.offsetHeight,
					clientHeight: leadHome.clientHeight,
					scrollHeight: leadHome.scrollHeight,
					getBoundingClientRect: leadHome.getBoundingClientRect(),
				},
			};
		} );

		console.log( 'FULL ELEMENT INSPECTION:' );
		console.log( JSON.stringify( fullInspection, null, 2 ) );

		await browser.close();
	} catch ( error ) {
		console.error( 'Error:', error.message );
	}
} )();
