/** @param {string} output */
export function hasWorkerErrors(output) {
	return /EmDash middleware error|Cannot read properties of undefined \(reading 'every'\)|ReferenceError|Cannot access .* before initialization|Unhandled|\[ERROR\]/.test(
		output,
	);
}
