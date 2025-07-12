// Simple script to run in browser console
const leadHome = document.querySelector( '.lead-home' );
if ( leadHome ) {
	const rect = leadHome.getBoundingClientRect();
	const style = window.getComputedStyle( leadHome );
	const measurements = {
		actualHeight: Math.round( rect.height ),
		contentHeight: leadHome.scrollHeight,
		computedHeight: style.height,
		computedMinHeight: style.minHeight,
		computedDisplay: style.display,
		computedFlexDirection: style.flexDirection,
		paddingTop: style.paddingTop,
		paddingBottom: style.paddingBottom,
		viewport: { width: window.innerWidth, height: window.innerHeight },
	};
	console.log( 'MEASUREMENTS:', JSON.stringify( measurements, null, 2 ) );
} else {
	console.log( 'ERROR: .lead-home element not found' );
}
