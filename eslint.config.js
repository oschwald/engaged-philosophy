import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import astroPlugin from "eslint-plugin-astro";

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
	...astroPlugin.configs["flat/recommended"],
	{
		files: ["**/*.{js,mjs,cjs}"],
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
	{
		files: ["**/*.{ts,mts,cts}"],
		languageOptions: {
			parser: tsParser,
			ecmaVersion: "latest",
			sourceType: "module",
			globals: {
				console: "readonly",
				process: "readonly",
			},
		},
		plugins: {
			"@typescript-eslint": tsPlugin,
		},
		rules: {
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
		},
	},
	{
		files: ["**/*.astro"],
		rules: {
			"astro/no-set-html-directive": "off",
		},
	},
];
