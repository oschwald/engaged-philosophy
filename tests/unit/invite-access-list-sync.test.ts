import { afterEach, describe, expect, test, vi } from "vitest";

import {
	CloudflareAccessEmailListConfigError,
	CloudflareAccessEmailListApiError,
	getCloudflareAccessEmailListDashboardUrl,
	syncCloudflareAccessEmailListEmail,
} from "../../src/lib/cloudflare-access-lists";

interface FetchCall {
	url: string;
	init?: RequestInit;
}

afterEach(() => {
	vi.useRealTimers();
});

function createJsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function createFetchImpl(calls: FetchCall[]): typeof fetch {
	let appended = false;
	return async (input, init) => {
		calls.push({ url: String(input), init });
		if (String(input).endsWith("/gateway/lists/list-id")) {
			if (init?.method === "PATCH") {
				appended = true;
			}

			return createJsonResponse({
				success: true,
				result: {
					id: "list-id",
					name: "EmDash admin invitees",
					type: "EMAIL",
				},
			});
		}

		if (String(input).includes("/gateway/lists/list-id/items")) {
			return createJsonResponse({
				success: true,
				result: appended
					? [{ value: "admin@example.com" }, { value: "newuser@example.com" }]
					: [{ value: "admin@example.com" }],
				result_info: {
					page: 1,
					count: appended ? 2 : 1,
					per_page: 1000,
					total_count: appended ? 2 : 1,
				},
			});
		}

		return createJsonResponse({
			success: true,
			result: {
				id: "list-id",
				name: "EmDash admin invitees",
				type: "EMAIL",
				items: [
					{ value: "admin@example.com" },
					{ value: "newuser@example.com" },
				],
			},
		});
	};
}

describe("Cloudflare Access email list helpers", () => {
	test("builds a Zero Trust lists dashboard URL", () => {
		expect(getCloudflareAccessEmailListDashboardUrl("account-id")).toBe(
			"https://dash.cloudflare.com/account-id/zero-trust/lists",
		);
		expect(getCloudflareAccessEmailListDashboardUrl()).toBe(
			"https://dash.cloudflare.com",
		);
	});

	test("skips Cloudflare calls when list sync is not configured", async () => {
		const calls: FetchCall[] = [];
		const fetchImpl: typeof fetch = async (input, init) => {
			calls.push({ url: String(input), init });
			return createJsonResponse({ success: true, result: {} });
		};

		await expect(
			syncCloudflareAccessEmailListEmail({}, "user@example.com", fetchImpl),
		).resolves.toEqual({
			status: "not_configured",
			dashboardUrl: "https://dash.cloudflare.com",
		});
		expect(calls).toHaveLength(0);
	});

	test("ignores a legacy account ID secret when list sync is otherwise absent", async () => {
		const calls: FetchCall[] = [];
		const fetchImpl: typeof fetch = async (input, init) => {
			calls.push({ url: String(input), init });
			return createJsonResponse({ success: true, result: {} });
		};

		await expect(
			syncCloudflareAccessEmailListEmail(
				{ accountId: "account-id" },
				"user@example.com",
				fetchImpl,
			),
		).resolves.toEqual({
			status: "not_configured",
			dashboardUrl: "https://dash.cloudflare.com/account-id/zero-trust/lists",
		});
		expect(calls).toHaveLength(0);
	});

	test("fails when list sync is partially configured", async () => {
		await expect(
			syncCloudflareAccessEmailListEmail(
				{
					accountId: "account-id",
					listId: "list-id",
				},
				"user@example.com",
			),
		).rejects.toBeInstanceOf(CloudflareAccessEmailListConfigError);
	});

	test("appends a missing email to a Zero Trust email list", async () => {
		const calls: FetchCall[] = [];
		let itemLookupCount = 0;
		const fetchImpl: typeof fetch = async (input, init) => {
			calls.push({ url: String(input), init });
			if (String(input).endsWith("/gateway/lists/list-id")) {
				if (init?.method === "PATCH") {
					return createJsonResponse({
						success: true,
						result: {
							id: "list-id",
							name: "EmDash admin invitees",
							type: "EMAIL",
						},
					});
				}

				return createJsonResponse({
					success: true,
					result: {
						id: "list-id",
						name: "EmDash admin invitees",
						type: "EMAIL",
					},
				});
			}

			itemLookupCount += 1;
			return createJsonResponse({
				success: true,
				result:
					itemLookupCount === 1
						? [{ value: "admin@example.com" }]
						: [
								{ value: "admin@example.com" },
								{ value: "newuser@example.com" },
							],
				result_info: {
					page: 1,
					count: itemLookupCount === 1 ? 1 : 2,
					per_page: 1000,
					total_count: itemLookupCount === 1 ? 1 : 2,
				},
			});
		};

		await expect(
			syncCloudflareAccessEmailListEmail(
				{
					accountId: "account-id",
					listId: "list-id",
					apiToken: "secret-token",
				},
				"NewUser@Example.com",
				fetchImpl,
			),
		).resolves.toEqual({
			status: "added",
			dashboardUrl: "https://dash.cloudflare.com/account-id/zero-trust/lists",
		});

		expect(calls.map((call) => call.init?.method ?? "GET")).toEqual([
			"GET",
			"GET",
			"PATCH",
			"GET",
		]);
		expect(calls[2]?.url).toBe(
			"https://api.cloudflare.com/client/v4/accounts/account-id/gateway/lists/list-id",
		);
		expect(calls[2]?.init?.headers).toMatchObject({
			Authorization: "Bearer secret-token",
			"Content-Type": "application/json",
		});
		expect(JSON.parse(String(calls[2]?.init?.body))).toEqual({
			append: [
				{
					value: "newuser@example.com",
					description: "EmDash admin invite",
				},
			],
		});
	});

	test("does not append when the email already exists", async () => {
		const calls: FetchCall[] = [];
		const fetchImpl: typeof fetch = async (input, init) => {
			calls.push({ url: String(input), init });
			if (String(input).endsWith("/gateway/lists/list-id")) {
				return createJsonResponse({
					success: true,
					result: {
						id: "list-id",
						name: "EmDash admin invitees",
						type: "EMAIL",
					},
				});
			}

			return createJsonResponse({
				success: true,
				result: [{ value: "user@example.com" }],
				result_info: {
					page: 1,
					count: 1,
					per_page: 1000,
					total_count: 1,
				},
			});
		};

		await expect(
			syncCloudflareAccessEmailListEmail(
				{
					accountId: "account-id",
					listId: "list-id",
					apiToken: "secret-token",
				},
				"USER@example.com",
				fetchImpl,
			),
		).resolves.toEqual({
			status: "already_present",
			dashboardUrl: "https://dash.cloudflare.com/account-id/zero-trust/lists",
		});
		expect(calls.map((call) => call.init?.method ?? "GET")).toEqual([
			"GET",
			"GET",
		]);
	});

	test("treats a duplicate append race as already present", async () => {
		const calls: FetchCall[] = [];
		let itemLookupCount = 0;
		const fetchImpl: typeof fetch = async (input, init) => {
			calls.push({ url: String(input), init });
			if (String(input).endsWith("/gateway/lists/list-id")) {
				if (init?.method === "PATCH") {
					return createJsonResponse(
						{
							success: false,
							errors: [{ message: "duplicate list item" }],
						},
						409,
					);
				}

				return createJsonResponse({
					success: true,
					result: {
						id: "list-id",
						name: "EmDash admin invitees",
						type: "EMAIL",
					},
				});
			}

			itemLookupCount += 1;
			return createJsonResponse({
				success: true,
				result: itemLookupCount === 1 ? [] : [{ value: "newuser@example.com" }],
				result_info: {
					page: 1,
					count: itemLookupCount === 1 ? 0 : 1,
					per_page: 1000,
					total_count: itemLookupCount === 1 ? 0 : 1,
				},
			});
		};

		await expect(
			syncCloudflareAccessEmailListEmail(
				{
					accountId: "account-id",
					listId: "list-id",
					apiToken: "secret-token",
				},
				"newuser@example.com",
				fetchImpl,
			),
		).resolves.toEqual({
			status: "already_present",
			dashboardUrl: "https://dash.cloudflare.com/account-id/zero-trust/lists",
		});
	});

	test("rejects a configured invite list that is not an email list", async () => {
		const fetchImpl: typeof fetch = async () =>
			createJsonResponse({
				success: true,
				result: {
					id: "list-id",
					name: "Admin IPs",
					type: "IP",
				},
			});

		await expect(
			syncCloudflareAccessEmailListEmail(
				{
					accountId: "account-id",
					listId: "list-id",
					apiToken: "secret-token",
				},
				"user@example.com",
				fetchImpl,
			),
		).rejects.toThrow("EMAIL list");
	});

	test("does not use the Access group full replacement endpoint", async () => {
		const calls: FetchCall[] = [];

		await syncCloudflareAccessEmailListEmail(
			{
				accountId: "account-id",
				listId: "list-id",
				apiToken: "secret-token",
			},
			"newuser@example.com",
			createFetchImpl(calls),
		);

		expect(calls.some((call) => call.url.includes("/access/groups/"))).toBe(
			false,
		);
		expect(calls.some((call) => call.init?.method === "PUT")).toBe(false);
	});

	test("times out stalled Cloudflare requests", async () => {
		vi.useFakeTimers();
		const fetchImpl: typeof fetch = async (_input, init) =>
			new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener("abort", () => {
					reject(new DOMException("The operation was aborted.", "AbortError"));
				});
			});

		const syncError = syncCloudflareAccessEmailListEmail(
			{
				accountId: "account-id",
				listId: "list-id",
				apiToken: "secret-token",
			},
			"user@example.com",
			fetchImpl,
		).catch((error: unknown) => error);

		await vi.advanceTimersByTimeAsync(10_000);
		const error = await syncError;
		expect(error).toBeInstanceOf(CloudflareAccessEmailListApiError);
		expect(error).toMatchObject({
			message: expect.stringContaining("timed out"),
		});
	});

	test("does not include the API token in Cloudflare error messages", async () => {
		const fetchImpl: typeof fetch = async () =>
			createJsonResponse(
				{
					success: false,
					errors: [{ message: "list not found" }],
				},
				404,
			);

		await expect(
			syncCloudflareAccessEmailListEmail(
				{
					accountId: "account-id",
					listId: "list-id",
					apiToken: "secret-token",
				},
				"user@example.com",
				fetchImpl,
			),
		).rejects.toThrow("list not found");

		await expect(
			syncCloudflareAccessEmailListEmail(
				{
					accountId: "account-id",
					listId: "list-id",
					apiToken: "secret-token",
				},
				"user@example.com",
				fetchImpl,
			),
		).rejects.not.toThrow("secret-token");
	});
});
