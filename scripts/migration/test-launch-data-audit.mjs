import assert from "node:assert/strict";

import { auditSeed } from "./audit-launch-data.mjs";

function seedWith(overrides = {}) {
	return {
		version: "1",
		taxonomies: [],
		redirects: [{ source: "/old-about/", destination: "/about/" }],
		content: {
			pages: [
				{
					id: "page-about",
					slug: "about",
					status: "published",
					data: {
						title: "About",
						path: "about",
						content: [
							{
								_type: "block",
								_key: "text",
								style: "normal",
								markDefs: [],
								children: [
									{
										_type: "span",
										_key: "span",
										text: "About page",
										marks: [],
									},
								],
							},
						],
					},
				},
			],
		},
		...overrides,
	};
}

assert.deepEqual(auditSeed(seedWith()), []);

const badSeed = seedWith({
	redirects: [
		{ source: "/old-about/", destination: "/missing/" },
		{ source: "/old-about/", destination: "/about/" },
	],
	content: {
		pages: [
			{
				id: "page-about",
				slug: "about",
				status: "published",
				data: {
					title: "About",
					path: "about",
					content: [
						{
							_type: "legacyImage",
							_key: "bad-image",
							id: "data:image/png;base64,aaaa",
						},
						{
							_type: "block",
							_key: "bad-link",
							style: "normal",
							markDefs: [],
							children: [
								{
									_type: "span",
									_key: "span",
									text: "https://www.engagedphilosophy.com/about/",
									marks: [],
								},
							],
						},
					],
				},
			},
		],
	},
});

const issueTypes = auditSeed(badSeed).map((issue) => issue.type);
assert(issueTypes.includes("nonDurableMediaReference"));
assert(issueTypes.includes("absoluteInternalUrl"));
assert(issueTypes.includes("missingRedirectDestination"));
assert(issueTypes.includes("duplicateRedirectSource"));

console.log("Launch data audit tests passed.");
