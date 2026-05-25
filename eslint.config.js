export default [
	{
		ignores: [
			"build/**",
			"dist/**",
			".astro/**",
			".wrangler/**",
			"node_modules/**",
			"src/node_modules/**",
			"seed/**",
			"public/**",
		],
	},
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "module",
			globals: {
				bootstrap: "readonly",
				console: "readonly",
				document: "readonly",
				process: "readonly",
				window: "readonly",
			},
		},
		rules: {
			"no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
		},
	},
];
