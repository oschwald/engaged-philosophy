#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import {
	parseSeedPathArg,
	readSeedFile,
	ROOT,
} from "./lib/migration-seed-path.mjs";

const INTERNAL_SITE_URL_RE =
	/\bhttps?:\/\/(?:www\.)?engagedphilosophy\.com(?=\/|[?#]|$)/i;
const NON_DURABLE_MEDIA_RE =
	/(?:^|["'\s])(?:blob:|data:image\/|https?:\/\/attachments\.office\.net\/)/i;
const RAW_WORDPRESS_UPLOAD_RE =
	/(?:https?:\/\/(?:www\.|media\.)?engagedphilosophy\.com)?\/wp-content\/uploads\//i;
const EMDASH_MEDIA_FILE_PREFIX = "/_emdash/api/media/file/";

function walk(value, visit, pathParts = []) {
	visit(value, pathParts);
	if (Array.isArray(value)) {
		value.forEach((item, index) => walk(item, visit, [...pathParts, index]));
		return;
	}
	if (value && typeof value === "object") {
		for (const [key, item] of Object.entries(value)) {
			walk(item, visit, [...pathParts, key]);
		}
	}
}

function pathLabel(pathParts) {
	return pathParts.map((part) => String(part)).join(".");
}

function entryLabel(collection, entry) {
	return `${collection}:${entry.id} ${entry.data?.path || entry.slug || ""}`.trim();
}

function normalizeRoute(value) {
	const withoutQuery = String(value || "")
		.split("#")[0]
		.split("?")[0]
		.replace(/^\/+|\/+$/g, "");
	return withoutQuery ? `/${withoutQuery}/` : "/";
}

function collectRoutes(seed) {
	const routes = new Set(["/", "/blog/", "/project/"]);

	for (const entries of Object.values(seed.content ?? {})) {
		for (const entry of entries ?? []) {
			if (entry?.data?.path !== undefined) {
				routes.add(normalizeRoute(entry.data.path));
			}
		}
	}

	for (const taxonomy of seed.taxonomies ?? []) {
		for (const term of taxonomy.terms ?? []) {
			routes.add(normalizeRoute(`${taxonomy.name}/${term.slug}`));
		}
	}

	return routes;
}

function hasRawWordPressUpload(value) {
	return (
		RAW_WORDPRESS_UPLOAD_RE.test(value) &&
		!value.startsWith(EMDASH_MEDIA_FILE_PREFIX)
	);
}

function auditString(value, context, issues) {
	if (NON_DURABLE_MEDIA_RE.test(value)) {
		issues.push({
			type: "nonDurableMediaReference",
			...context,
			value,
		});
	}

	if (INTERNAL_SITE_URL_RE.test(value)) {
		issues.push({
			type: "absoluteInternalUrl",
			...context,
			value,
		});
	}

	if (hasRawWordPressUpload(value)) {
		issues.push({
			type: "rawWordPressUpload",
			...context,
			value,
		});
	}
}

function auditMediaBlock(value, context, issues) {
	if (value._type === "legacyImage" && !value.id) {
		issues.push({
			type: "missingLegacyImageSource",
			...context,
			value: value._key || "",
		});
	}

	if (value._type === "image" && !value.asset?._ref && !value.asset?.url) {
		issues.push({
			type: "missingImageAsset",
			...context,
			value: value._key || "",
		});
	}

	if (value._type !== "gallery") return;
	for (const [index, image] of (value.images ?? []).entries()) {
		if (!image?.asset?._ref && !image?.asset?.url && !image?.url) {
			issues.push({
				type: "missingGalleryImageSource",
				...context,
				path: `${context.path}.images.${index}`,
				value: image?._key || "",
			});
		}
	}
}

function auditRedirects(seed, routes, issues) {
	const sources = new Set();
	for (const [index, redirect] of (seed.redirects ?? []).entries()) {
		const pathPrefix = `redirects.${index}`;
		if (!redirect?.source || !redirect?.destination) {
			issues.push({
				type: "invalidRedirect",
				entry: "seed",
				path: pathPrefix,
				value: redirect,
			});
			continue;
		}

		if (sources.has(redirect.source)) {
			issues.push({
				type: "duplicateRedirectSource",
				entry: "seed",
				path: `${pathPrefix}.source`,
				value: redirect.source,
			});
		}
		sources.add(redirect.source);

		if (
			normalizeRoute(redirect.source) === normalizeRoute(redirect.destination)
		) {
			issues.push({
				type: "selfRedirect",
				entry: "seed",
				path: pathPrefix,
				value: redirect.source,
			});
		}

		if (!routes.has(normalizeRoute(redirect.destination))) {
			issues.push({
				type: "missingRedirectDestination",
				entry: "seed",
				path: `${pathPrefix}.destination`,
				value: redirect.destination,
			});
		}
	}
}

export function auditSeed(seed) {
	const issues = [];
	const routes = collectRoutes(seed);

	for (const [collection, entries] of Object.entries(seed.content ?? {})) {
		for (const entry of entries ?? []) {
			const entryName = entryLabel(collection, entry);
			walk(entry, (value, pathParts) => {
				const context = {
					entry: entryName,
					path: pathLabel(pathParts),
				};
				if (typeof value === "string") {
					auditString(value, context, issues);
					return;
				}
				if (value && typeof value === "object") {
					auditMediaBlock(value, context, issues);
				}
			});
		}
	}

	for (const redirect of seed.redirects ?? []) {
		auditString(
			redirect.source ?? "",
			{
				entry: "seed",
				path: "redirects.source",
			},
			issues,
		);
		auditString(
			redirect.destination ?? "",
			{
				entry: "seed",
				path: "redirects.destination",
			},
			issues,
		);
	}
	auditRedirects(seed, routes, issues);

	return issues;
}

function formatIssue(issue) {
	return [
		`- ${issue.type}`,
		issue.entry,
		issue.path,
		JSON.stringify(issue.value).slice(0, 180),
	].join(" | ");
}

function runCli() {
	const seedPath = parseSeedPathArg(process.argv.slice(2));
	if (!fs.existsSync(seedPath)) {
		console.log(
			`Migration seed not found at ${path.relative(ROOT, seedPath)}; skipping launch data audit.`,
		);
		return;
	}

	const issues = auditSeed(readSeedFile(seedPath));
	if (issues.length === 0) {
		console.log(
			`Launch data audit passed for ${path.relative(ROOT, seedPath)}.`,
		);
		return;
	}

	console.error(
		`Launch data audit found ${issues.length} issue(s) in ${path.relative(ROOT, seedPath)}:`,
	);
	for (const issue of issues.slice(0, 50)) {
		console.error(formatIssue(issue));
	}
	if (issues.length > 50) {
		console.error(`...and ${issues.length - 50} more.`);
	}
	process.exit(1);
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	runCli();
}
