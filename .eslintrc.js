module.exports = {
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: 'module',
	},
	globals: {
		// WordPress globals
		wp: 'readonly',
		the_bootstrap_customize: 'readonly',
		
		// Bootstrap 5 global
		bootstrap: 'readonly',
		
		// WordPress customizer API
		customize: 'readonly',
		
		// Node.js globals for webpack config
		require: 'readonly',
		module: 'readonly',
		__dirname: 'readonly',
		process: 'readonly',
	},
	env: {
		browser: true,
		es6: true,
		node: true,
	},
	rules: {
		// Allow WordPress-style variable names
		camelcase: [
			'error',
			{
				allow: [ 'the_bootstrap_customize' ],
			},
		],
	},
};