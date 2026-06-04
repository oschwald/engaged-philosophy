import { describe, expect, test } from "vitest";

import { auditSeed } from "../../../scripts/migration/audit-launch-data.mjs";

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

describe("launch data audit", () => {
	test("passes valid launch seed data", () => {
		expect(auditSeed(seedWith())).toEqual([]);
	});

	test("reports non-durable media, absolute internal URLs, and bad redirects", () => {
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

		const issueTypes = auditSeed(badSeed).map(
			(issue: { type: string }) => issue.type,
		);
		expect(issueTypes).toContain("nonDurableMediaReference");
		expect(issueTypes).toContain("absoluteInternalUrl");
		expect(issueTypes).toContain("missingRedirectDestination");
		expect(issueTypes).toContain("duplicateRedirectSource");
	});
});
