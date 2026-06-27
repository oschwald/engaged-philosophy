import { Role } from "@emdash-cms/auth";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { CloudflareAccessEmailListSyncResult } from "../../src/lib/cloudflare-access-lists";

const mocks = vi.hoisted(() => ({
	adapter: {
		getUserByEmail: vi.fn(),
		createUser: vi.fn(),
		deleteUser: vi.fn(),
	},
	syncCloudflareAccessEmailListEmail: vi.fn(),
}));

vi.mock("@emdash-cms/auth/adapters/kysely", () => ({
	createKyselyAdapter: () => mocks.adapter,
}));

vi.mock("../../src/lib/cloudflare-access-lists", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("../../src/lib/cloudflare-access-lists")
		>();

	return {
		...actual,
		syncCloudflareAccessEmailListEmail:
			mocks.syncCloudflareAccessEmailListEmail,
	};
});

const { CloudflareAccessEmailListApiError } =
	await import("../../src/lib/cloudflare-access-lists");
const { POST } =
	await import("../../src/emdash-routes/cloudflare-access-invite");

function createInviteRequest(body: unknown): Parameters<typeof POST>[0] {
	return {
		request: new Request("https://example.com/_emdash/api/auth/invite", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
		locals: {
			emdash: { db: {} },
			user: { role: Role.ADMIN },
		},
	} as unknown as Parameters<typeof POST>[0];
}

function accessSyncResult(
	status: CloudflareAccessEmailListSyncResult["status"],
): CloudflareAccessEmailListSyncResult {
	return {
		status,
		dashboardUrl: "https://dash.cloudflare.com/account/one/access/policies",
	};
}

describe("Cloudflare Access invite route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		for (const name of [
			"CLOUDFLARE_ACCESS_INVITE_ACCOUNT_ID",
			"CLOUDFLARE_ACCESS_INVITE_EMAIL_LIST_ID",
			"CLOUDFLARE_ACCESS_INVITE_EMAIL_LIST_API_TOKEN",
		]) {
			delete process.env[name];
		}
	});

	test("creates the EmDash user before granting Cloudflare Access", async () => {
		const events: string[] = [];
		mocks.adapter.getUserByEmail.mockResolvedValue(null);
		mocks.adapter.createUser.mockImplementation(async () => {
			events.push("create-user");
			return { id: "user-id" };
		});
		mocks.syncCloudflareAccessEmailListEmail.mockImplementation(async () => {
			events.push("sync-access");
			return accessSyncResult("added");
		});

		const response = await POST(
			createInviteRequest({ email: "person@example.com" }),
		);

		expect(response.status).toBe(200);
		expect(events).toEqual(["create-user", "sync-access"]);
		expect(mocks.adapter.createUser).toHaveBeenCalledWith({
			email: "person@example.com",
			role: Role.AUTHOR,
			emailVerified: true,
		});
	});

	test("returns manual Access instructions for an existing user when list sync is absent", async () => {
		mocks.adapter.getUserByEmail.mockResolvedValue({
			id: "user-id",
			email: "person@example.com",
		});
		mocks.syncCloudflareAccessEmailListEmail.mockResolvedValue(
			accessSyncResult("not_configured"),
		);

		const response = await POST(
			createInviteRequest({ email: "person@example.com" }),
		);
		const body = (await response.json()) as {
			data: { cloudflareAccess: string; message: string; userCreated: boolean };
		};

		expect(response.status).toBe(200);
		expect(body.data.cloudflareAccess).toBe("not_configured");
		expect(body.data.userCreated).toBe(false);
		expect(body.data.message).toContain("already exists in EmDash");
	});

	test("removes a newly created EmDash user when Access sync fails", async () => {
		const events: string[] = [];
		mocks.adapter.getUserByEmail.mockResolvedValue(null);
		mocks.adapter.createUser.mockImplementation(async () => {
			events.push("create-user");
			return { id: "user-id" };
		});
		mocks.syncCloudflareAccessEmailListEmail.mockImplementation(async () => {
			events.push("sync-access");
			throw new CloudflareAccessEmailListApiError("Access update failed.");
		});
		mocks.adapter.deleteUser.mockImplementation(async () => {
			events.push("delete-user");
		});

		const response = await POST(
			createInviteRequest({ email: "person@example.com" }),
		);
		const body = (await response.json()) as { error: { code: string } };

		expect(response.status).toBe(502);
		expect(body.error.code).toBe("ACCESS_UPDATE_ERROR");
		expect(events).toEqual(["create-user", "sync-access", "delete-user"]);
		expect(mocks.adapter.deleteUser).toHaveBeenCalledWith("user-id");
	});

	test("reports when rollback fails after Access sync fails", async () => {
		mocks.adapter.getUserByEmail.mockResolvedValue(null);
		mocks.adapter.createUser.mockResolvedValue({ id: "user-id" });
		mocks.syncCloudflareAccessEmailListEmail.mockRejectedValue(
			new CloudflareAccessEmailListApiError("Access update failed."),
		);
		mocks.adapter.deleteUser.mockRejectedValue(new Error("D1 unavailable"));

		const response = await POST(
			createInviteRequest({ email: "person@example.com" }),
		);
		const body = (await response.json()) as { error: { code: string } };

		expect(response.status).toBe(500);
		expect(body.error.code).toBe("ACCESS_ROLLBACK_ERROR");
	});
});
