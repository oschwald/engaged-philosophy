import { Role } from "@emdash-cms/auth";
import { describe, expect, test } from "vitest";

import {
	getCloudflareAccessInviteUrl,
	normalizeCloudflareAccessInviteBody,
} from "../../src/lib/cloudflare-access-invite";

describe("Cloudflare Access invite helpers", () => {
	test("redirects invites to the admin panel", () => {
		expect(
			getCloudflareAccessInviteUrl(
				"https://engaged-philosophy.ramona75.workers.dev/_emdash/api/auth/invite",
			),
		).toBe("https://engaged-philosophy.ramona75.workers.dev/_emdash/admin");
	});

	test("normalizes invite body with default role", () => {
		const result = normalizeCloudflareAccessInviteBody({
			email: "  Example@EngagedPhilosophy.com ",
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.email).toBe("example@engagedphilosophy.com");
			expect(result.value.role).toBe(Role.AUTHOR);
		}
	});

	test("accepts explicit valid roles", () => {
		const result = normalizeCloudflareAccessInviteBody({
			email: "editor@example.com",
			role: Role.EDITOR,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.role).toBe(Role.EDITOR);
		}
	});

	test("rejects invalid email and role values", () => {
		expect(
			normalizeCloudflareAccessInviteBody({ email: "not-an-email" }),
		).toEqual(
			expect.objectContaining({
				ok: false,
				status: 400,
				code: "VALIDATION_ERROR",
			}),
		);
		expect(
			normalizeCloudflareAccessInviteBody({
				email: "user@example.com",
				role: 999,
			}),
		).toEqual(
			expect.objectContaining({
				ok: false,
				status: 400,
				code: "VALIDATION_ERROR",
			}),
		);
	});
});
