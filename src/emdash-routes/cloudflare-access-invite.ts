import { InviteError, Role } from "@emdash-cms/auth";
import {
	createKyselyAdapter,
	type AuthTables,
} from "@emdash-cms/auth/adapters/kysely";
import type { APIRoute } from "astro";
import type { Kysely } from "kysely";

import {
	CLOUDFLARE_ACCESS_INVITE_MESSAGE,
	getCloudflareAccessInviteUrl,
	normalizeCloudflareAccessInviteBody,
} from "../lib/cloudflare-access-invite";

export const prerender = false;

const JSON_HEADERS = {
	"Cache-Control": "private, no-store",
} as const;

function apiSuccess(data: unknown, status = 200): Response {
	return Response.json({ data }, { status, headers: JSON_HEADERS });
}

function apiError(code: string, message: string, status: number): Response {
	return Response.json(
		{ error: { code, message } },
		{ status, headers: JSON_HEADERS },
	);
}

export const POST: APIRoute = async ({ request, locals }) => {
	const { emdash, user } = locals;

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

	try {
		const existingUser = await adapter.getUserByEmail(invite.value.email);
		if (existingUser) {
			return apiError(
				"USER_EXISTS",
				"A user with this email already exists.",
				409,
			);
		}

		await adapter.createUser({
			email: invite.value.email,
			role: invite.value.role,
			emailVerified: true,
		});

		return apiSuccess({
			success: true,
			message: CLOUDFLARE_ACCESS_INVITE_MESSAGE,
			inviteUrl: getCloudflareAccessInviteUrl(request.url),
		});
	} catch (error) {
		if (error instanceof InviteError) {
			return apiError(error.code.toUpperCase(), error.message, 400);
		}

		console.error("Failed to create Cloudflare Access user invite:", error);
		return apiError("INVITE_CREATE_ERROR", "Failed to create invite.", 500);
	}
};
