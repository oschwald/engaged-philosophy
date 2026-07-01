import { Role, type RoleLevel } from "@emdash-cms/auth";

const VALID_ROLE_LEVELS = new Set<number>(Object.values(Role));
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CLOUDFLARE_ACCESS_INVITE_MESSAGE =
	"User added to EmDash and Cloudflare Access. Share the admin URL with them.";

export const CLOUDFLARE_ACCESS_INVITE_EXISTING_USER_MESSAGE =
	"User already existed in EmDash and now has Cloudflare Access. Share the admin URL with them.";

export const CLOUDFLARE_ACCESS_INVITE_MANUAL_MESSAGE =
	"User added to EmDash. Add their email to the Cloudflare Access EMAIL list before sharing the admin URL.";

export const CLOUDFLARE_ACCESS_INVITE_EXISTING_USER_MANUAL_MESSAGE =
	"User already exists in EmDash. Add their email to the Cloudflare Access EMAIL list before sharing the admin URL.";

export interface NormalizedCloudflareAccessInvite {
	email: string;
	role: RoleLevel;
}

interface InviteValidationError {
	ok: false;
	status: number;
	code: string;
	message: string;
}

interface InviteValidationSuccess {
	ok: true;
	value: NormalizedCloudflareAccessInvite;
}

export type InviteValidationResult =
	InviteValidationError | InviteValidationSuccess;

export function getCloudflareAccessInviteUrl(requestUrl: string | URL): string {
	const url = new URL(requestUrl);
	return `${url.origin}/_emdash/admin`;
}

function validationError(
	code: string,
	message: string,
	status = 400,
): InviteValidationError {
	return { ok: false, status, code, message };
}

export function normalizeCloudflareAccessInviteBody(
	body: unknown,
): InviteValidationResult {
	if (!body || typeof body !== "object") {
		return validationError(
			"VALIDATION_ERROR",
			"Invite request body must be an object.",
		);
	}

	const input = body as Record<string, unknown>;
	const email =
		typeof input.email === "string" ? input.email.trim().toLowerCase() : "";

	if (!email || !EMAIL_PATTERN.test(email)) {
		return validationError(
			"VALIDATION_ERROR",
			"A valid email address is required.",
		);
	}

	const role = input.role ?? Role.AUTHOR;
	if (
		typeof role !== "number" ||
		!Number.isInteger(role) ||
		!VALID_ROLE_LEVELS.has(role)
	) {
		return validationError("VALIDATION_ERROR", "A valid role is required.");
	}

	return {
		ok: true,
		value: {
			email,
			role: role as RoleLevel,
		},
	};
}
