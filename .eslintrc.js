module.exports = {
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: 'module',
	},
	globals: {
		bootstrap: 'readonly',

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
};