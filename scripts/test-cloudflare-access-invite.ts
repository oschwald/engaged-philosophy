import assert from "node:assert/strict";

import { Role } from "@emdash-cms/auth";

import {
	getCloudflareAccessInviteUrl,
	normalizeCloudflareAccessInviteBody,
} from "../src/lib/cloudflare-access-invite.ts";

assert.equal(
	getCloudflareAccessInviteUrl(
		"https://engaged-philosophy.ramona75.workers.dev/_emdash/api/auth/invite",
	),
	"https://engaged-philosophy.ramona75.workers.dev/_emdash/admin",
);

const defaultRole = normalizeCloudflareAccessInviteBody({
	email: "  Example@EngagedPhilosophy.com ",
});
assert.equal(defaultRole.ok, true);
if (defaultRole.ok) {
	assert.equal(defaultRole.value.email, "example@engagedphilosophy.com");
	assert.equal(defaultRole.value.role, Role.AUTHOR);
}

const editorRole = normalizeCloudflareAccessInviteBody({
	email: "editor@example.com",
	role: Role.EDITOR,
});
assert.equal(editorRole.ok, true);
if (editorRole.ok) {
	assert.equal(editorRole.value.role, Role.EDITOR);
}

const invalidEmail = normalizeCloudflareAccessInviteBody({
	email: "not-an-email",
});
assert.equal(invalidEmail.ok, false);
if (!invalidEmail.ok) {
	assert.equal(invalidEmail.status, 400);
	assert.equal(invalidEmail.code, "VALIDATION_ERROR");
}

const invalidRole = normalizeCloudflareAccessInviteBody({
	email: "user@example.com",
	role: 999,
});
assert.equal(invalidRole.ok, false);
if (!invalidRole.ok) {
	assert.equal(invalidRole.status, 400);
	assert.equal(invalidRole.code, "VALIDATION_ERROR");
}

console.log("Cloudflare Access invite tests passed.");
