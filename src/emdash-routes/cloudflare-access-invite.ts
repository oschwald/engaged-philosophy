import { InviteError, Role } from "@emdash-cms/auth";
import {
	createKyselyAdapter,
	type AuthTables,
} from "@emdash-cms/auth/adapters/kysely";
import type { APIRoute } from "astro";
import { env as cloudflareEnv } from "cloudflare:workers";
import type { Kysely } from "kysely";

import {
	CloudflareAccessEmailListApiError,
	CloudflareAccessEmailListConfigError,
	syncCloudflareAccessEmailListEmail,
	type CloudflareAccessEmailListConfig,
	type CloudflareAccessEmailListSyncResult,
} from "../lib/cloudflare-access-lists";
import {
	CLOUDFLARE_ACCESS_INVITE_EXISTING_USER_MESSAGE,
	CLOUDFLARE_ACCESS_INVITE_EXISTING_USER_MANUAL_MESSAGE,
	CLOUDFLARE_ACCESS_INVITE_MANUAL_MESSAGE,
	CLOUDFLARE_ACCESS_INVITE_MESSAGE,
	getCloudflareAccessInviteUrl,
	normalizeCloudflareAccessInviteBody,
} from "../lib/cloudflare-access-invite";

export const prerender = false;

const JSON_HEADERS = {
	"Cache-Control": "private, no-store",
} as const;

interface InviteRouteLocals {
	emdash?: {
		db?: unknown;
	};
	user?: {
		role: number;
	};
}

function apiSuccess(data: unknown, status = 200): Response {
	return Response.json({ data }, { status, headers: JSON_HEADERS });
}

function apiError(code: string, message: string, status: number): Response {
	return Response.json(
		{ error: { code, message } },
		{ status, headers: JSON_HEADERS },
	);
}

function getRuntimeEnv(name: string): string | undefined {
	const processValue =
		typeof process !== "undefined" ? process.env?.[name] : undefined;
	if (processValue) return processValue;

	return (cloudflareEnv as Record<string, string | undefined>)[name];
}

function getCloudflareAccessEmailListConfig(): CloudflareAccessEmailListConfig {
	return {
		accountId: getRuntimeEnv("CLOUDFLARE_ACCESS_INVITE_ACCOUNT_ID"),
		listId: getRuntimeEnv("CLOUDFLARE_ACCESS_INVITE_EMAIL_LIST_ID"),
		apiToken: getRuntimeEnv("CLOUDFLARE_ACCESS_INVITE_EMAIL_LIST_API_TOKEN"),
	};
}

function inviteSuccessData({
	accessSync,
	inviteUrl,
	message,
	userCreated,
}: {
	accessSync: CloudflareAccessEmailListSyncResult;
	inviteUrl: string;
	message: string;
	userCreated: boolean;
}) {
	return {
		success: true,
		message,
		inviteUrl,
		zeroTrustUrl: accessSync.dashboardUrl,
		cloudflareAccess: accessSync.status,
		userCreated,
	};
}

export const POST: APIRoute = async ({ request, locals }) => {
	const { emdash, user } = locals as InviteRouteLocals;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}

	if (!user || user.role < Role.ADMIN) {
		return apiError("FORBIDDEN", "Admin privileges required", 403);
	}

	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return apiError("INVALID_JSON", "Request body must be valid JSON.", 400);
	}

	const invite = normalizeCloudflareAccessInviteBody(json);
	if (!invite.ok) {
		return apiError(invite.code, invite.message, invite.status);
	}

	const adapter = createKyselyAdapter(
		emdash.db as unknown as Kysely<AuthTables>,
	);
	const inviteUrl = getCloudflareAccessInviteUrl(request.url);
	const accessEmailListConfig = getCloudflareAccessEmailListConfig();

	try {
		const existingUser = await adapter.getUserByEmail(invite.value.email);
		if (existingUser) {
			const accessSync = await syncCloudflareAccessEmailListEmail(
				accessEmailListConfig,
				invite.value.email,
			);

			return apiSuccess(
				inviteSuccessData({
					accessSync,
					inviteUrl,
					message:
						accessSync.status === "not_configured"
							? CLOUDFLARE_ACCESS_INVITE_EXISTING_USER_MANUAL_MESSAGE
							: CLOUDFLARE_ACCESS_INVITE_EXISTING_USER_MESSAGE,
					userCreated: false,
				}),
			);
		}

		const createdUser = await adapter.createUser({
			email: invite.value.email,
			role: invite.value.role,
			emailVerified: true,
		});

		let accessSync: CloudflareAccessEmailListSyncResult;
		try {
			accessSync = await syncCloudflareAccessEmailListEmail(
				accessEmailListConfig,
				invite.value.email,
			);
		} catch (error) {
			try {
				await adapter.deleteUser(createdUser.id);
			} catch (rollbackError) {
				console.error(
					"Failed to remove EmDash user after Cloudflare Access sync failure:",
					rollbackError,
				);
				return apiError(
					"ACCESS_ROLLBACK_ERROR",
					"Cloudflare Access sync failed and the created EmDash user could not be removed. Manual cleanup is required.",
					500,
				);
			}
			throw error;
		}

		return apiSuccess({
			...inviteSuccessData({
				accessSync,
				inviteUrl,
				message:
					accessSync.status === "not_configured"
						? CLOUDFLARE_ACCESS_INVITE_MANUAL_MESSAGE
						: CLOUDFLARE_ACCESS_INVITE_MESSAGE,
				userCreated: true,
			}),
		});
	} catch (error) {
		if (error instanceof InviteError) {
			return apiError(error.code.toUpperCase(), error.message, 400);
		}

		if (error instanceof CloudflareAccessEmailListConfigError) {
			return apiError("ACCESS_CONFIG_ERROR", error.message, 500);
		}

		if (error instanceof CloudflareAccessEmailListApiError) {
			console.error("Failed to update Cloudflare Access invite list:", error);
			return apiError(
				"ACCESS_UPDATE_ERROR",
				"Failed to add user to Cloudflare Access.",
				502,
			);
		}

		console.error("Failed to create Cloudflare Access user invite:", error);
		return apiError("INVITE_CREATE_ERROR", "Failed to create invite.", 500);
	}
};
