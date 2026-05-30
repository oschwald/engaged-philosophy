#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { load } from "cheerio";
import pixelmatch from "pixelmatch";
import { chromium } from "playwright";
import { PNG } from "pngjs";

import seed from "../seed/seed.json" with { type: "json" };

const ROOT = process.cwd();
const DEFAULTS = {
	live: "https://www.engagedphilosophy.com",
	preview: "http://127.0.0.1:8791",
	limit: 600,
	concurrency: 6,
	textThreshold: 0.93,
	lengthThreshold: 0.12,
	visualLimit: 25,
	outputDir: path.join(ROOT, ".parity-audit"),
	configPath: path.join(ROOT, "scripts", "parity-audit.config.json"),
	browserPath: process.env.PARITY_AUDIT_BROWSER_PATH || "",
	route: "",
};

const VIEWPORTS = [
	{ id: "desktop", width: 1440, height: 1600 },
	{ id: "mobile", width: 390, height: 844 },
];

const CONTENT_BLOCK_SELECTOR =
	"p, h1, h2, h3, h4, h5, h6, ul, ol, li, hr, figure, img, video, iframe, blockquote";
const IGNORE_PATTERNS = [
	/^\/wp-/,
	/^\/wp-content\//,
	/^\/wp-json\//,
	/^\/feed\/?$/,
	/\/feed\/?$/,
	/^\/comments\//,
	/^\/cdn-cgi\//,
	/\/comment-page-\d+\//,
	/\?(?:replytocom|share|fbclid|utm_|output=)/i,
	/\.(?:xml|xsl|jpg|jpeg|png|gif|webp|svg|pdf|mp4|mov)$/i,
];

function parseArgs(argv) {
	const options = { ...DEFAULTS };
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		const next = argv[i + 1];
		if (arg === "--live" && next) {
			options.live = next;
			i += 1;
		} else if (arg === "--preview" && next) {
			options.preview = next;
			i += 1;
		} else if (arg === "--limit" && next) {
			options.limit = Number(next);
			i += 1;
		} else if (arg === "--concurrency" && next) {
			options.concurrency = Number(next);
			i += 1;
		} else if (arg === "--text-threshold" && next) {
			options.textThreshold = Number(next);
			i += 1;
		} else if (arg === "--length-threshold" && next) {
			options.lengthThreshold = Number(next);
			i += 1;
		} else if (arg === "--visual-limit" && next) {
			options.visualLimit = Number(next);
			i += 1;
		} else if (arg === "--output-dir" && next) {
			options.outputDir = path.resolve(ROOT, next);
			i += 1;
		} else if (arg === "--config" && next) {
			options.configPath = path.resolve(ROOT, next);
			i += 1;
		} else if (arg === "--browser-path" && next) {
			options.browserPath = path.resolve(ROOT, next);
			i += 1;
		} else if ((arg === "--route" || arg === "--path") && next) {
			options.route = normalizePath(next);
			i += 1;
		} else if (arg === "--base" && next) {
			options.live = next;
			i += 1;
		} else if (arg === "--candidate" && next) {
			options.preview = next;
			i += 1;
		}
	}
	return options;
}

function resolveBrowserPath(preferredPath) {
	const candidates = [
		preferredPath,
		process.env.PARITY_AUDIT_BROWSER_PATH,
		"/usr/bin/google-chrome",
		"/usr/bin/chromium",
		"/usr/bin/chromium-browser",
	].filter(Boolean);
	return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

function decodeEntities(value) {
	return value
		.replaceAll("&#038;", "&")
		.replaceAll("&amp;", "&")
		.replaceAll("&nbsp;", " ")
		.replaceAll("&#8211;", "–")
		.replaceAll("&#8212;", "—")
		.replaceAll("&#8216;", "‘")
		.replaceAll("&#8217;", "’")
		.replaceAll("&#8220;", "“")
		.replaceAll("&#8221;", "”")
		.replaceAll("&#8230;", "…")
		.replaceAll("&quot;", '"');
}

function normalizePath(inputPath) {
	if (!inputPath) return "/";
	let value = inputPath.replace(/https?:\/\/[^/]+/i, "");
	try {
		value = decodeURIComponent(value);
	} catch {}
	if (!value.startsWith("/")) value = `/${value}`;
	value = value.replace(/\/+/g, "/");
	if (value !== "/" && value.endsWith("/index.html"))
		value = value.slice(0, -10);
	if (value !== "/" && !value.endsWith("/")) value = `${value}/`;
	return value;
}

function shouldIgnore(pathname) {
	return !pathname || IGNORE_PATTERNS.some((pattern) => pattern.test(pathname));
}

function getSeedRoutes() {
	const routes = new Set(["/", "/blog/", "/project/"]);
	for (const collection of ["pages", "posts", "projects"]) {
		for (const entry of seed.content?.[collection] ?? []) {
			if (entry.status === "published") {
				routes.add(normalizePath(entry.data.path || "/"));
			}
		}
	}
	for (const taxonomy of seed.taxonomies ?? []) {
		for (const term of taxonomy.terms ?? []) {
			routes.add(normalizePath(`/${taxonomy.name}/${term.slug}/`));
		}
	}
	return [...routes].sort();
}

function classifyRoute(pathname) {
	if (pathname === "/") return "home";
	if (pathname === "/blog/") return "blog";
	if (pathname === "/project/") return "project-archive";
	if (/^\/project\/[^/]+\/$/.test(pathname)) return "project";
	if (/^\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/$/.test(pathname)) return "post";
	if (/^\/category\/[^/]+\/$/.test(pathname)) return "category";
	if (
		/^\/(?:topic|schools|professors|courses|semesters)\/[^/]+\/(?:page\/\d+\/)?$/.test(
			pathname,
		)
	)
		return "taxonomy";
	if (/^\/[^/]+\/page\/\d+\/$/.test(pathname)) return "archive-page";
	if (pathname.split("/").filter(Boolean).length > 1) return "nested-page";
	return "page";
}

function tokenize(text) {
	return new Set(
		text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, " ")
			.trim()
			.split(/\s+/)
			.filter(Boolean),
	);
}

function similarity(a, b) {
	if (!a && !b) return 1;
	const left = tokenize(a);
	const right = tokenize(b);
	if (!left.size && !right.size) return 1;
	let overlap = 0;
	for (const token of left) {
		if (right.has(token)) overlap += 1;
	}
	return overlap / Math.max(left.size, right.size);
}

function ensureDir(targetPath) {
	fs.mkdirSync(targetPath, { recursive: true });
}

function sanitizeSlug(value) {
	return (
		value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "route"
	);
}

function readConfig(configPath) {
	if (!fs.existsSync(configPath)) return { suppressions: [] };
	return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

async function fetchPage(base, pathname) {
	const response = await fetch(`${base}${pathname}`, { redirect: "follow" });
	const html = await response.text();
	const links = new Set();
	const $ = load(html);
	$("a[href]").each((_, element) => {
		const href = $(element).attr("href") || "";
		if (/^(mailto:|tel:|javascript:)/i.test(href)) return;
		try {
			const url = new URL(href, `${base}${pathname}`);
			if (
				!url.hostname.includes("engagedphilosophy.com") &&
				url.hostname !== "127.0.0.1"
			)
				return;
			const normalized = normalizePath(url.pathname);
			if (!shouldIgnore(normalized)) links.add(normalized);
		} catch {}
	});
	return {
		status: response.status,
		finalUrl: response.url,
		html,
		links: [...links],
	};
}

async function crawl(base, starts, limit, concurrency, options = {}) {
	const queue = [...starts];
	const seen = new Set();
	const pages = new Map();
	let active = 0;
	const followLinks = options.followLinks ?? true;

	return await new Promise((resolve) => {
		const pump = () => {
			while (active < concurrency && queue.length && seen.size < limit) {
				const pathname = normalizePath(queue.shift());
				if (seen.has(pathname) || shouldIgnore(pathname)) continue;
				seen.add(pathname);
				active += 1;
				fetchPage(base, pathname)
					.then((page) => {
						pages.set(pathname, page);
						if (followLinks && page.status === 200) {
							for (const link of page.links) {
								if (!seen.has(link)) queue.push(link);
							}
						}
					})
					.catch((error) => {
						pages.set(pathname, {
							status: 0,
							finalUrl: `${base}${pathname}`,
							error: String(error),
							html: "",
							links: [],
						});
					})
					.finally(() => {
						active -= 1;
						if ((queue.length === 0 || seen.size >= limit) && active === 0) {
							resolve(pages);
							return;
						}
						pump();
					});
			}
			if ((queue.length === 0 || seen.size >= limit) && active === 0) {
				resolve(pages);
			}
		};
		pump();
	});
}

function normalizeText(value) {
	return decodeEntities(value || "")
		.replace(/\s+/g, " ")
		.trim();
}

function summarizeBlocks($, root) {
	const blocks = [];
	const counts = {
		p: 0,
		headings: 0,
		ul: 0,
		ol: 0,
		li: 0,
		hr: 0,
		figure: 0,
		img: 0,
		video: 0,
		iframe: 0,
		strong: 0,
		em: 0,
		links: 0,
		numberedHeadings: 0,
		sizedImages: 0,
		alignleft: 0,
		alignright: 0,
		aligncenter: 0,
	};
	const images = [];
	const links = [];

	root.find(CONTENT_BLOCK_SELECTOR).each((_, element) => {
		const node = $(element);
		const tag = (element.tagName || "").toLowerCase();
		const text = normalizeText(node.text()).slice(0, 180);
		const classes = (node.attr("class") || "").trim();

		if (tag === "p") counts.p += 1;
		if (/^h[1-6]$/.test(tag)) counts.headings += 1;
		if (tag === "ul") counts.ul += 1;
		if (tag === "ol") counts.ol += 1;
		if (tag === "li") counts.li += 1;
		if (tag === "hr") counts.hr += 1;
		if (tag === "figure") counts.figure += 1;
		if (tag === "img") counts.img += 1;
		if (tag === "video") counts.video += 1;
		if (tag === "iframe") counts.iframe += 1;

		if (/alignleft/.test(classes)) counts.alignleft += 1;
		if (/alignright/.test(classes)) counts.alignright += 1;
		if (/aligncenter/.test(classes)) counts.aligncenter += 1;

		if (tag === "img") {
			if (node.attr("width") || node.attr("height")) counts.sizedImages += 1;
			images.push({
				src: node.attr("src") || "",
				width: node.attr("width") || "",
				height: node.attr("height") || "",
				className: classes,
			});
		}

		if (
			["p", "li", "hr", "figure", "video", "iframe"].includes(tag) ||
			/^h[1-6]$/.test(tag)
		) {
			blocks.push({
				tag,
				text,
				className: classes || undefined,
			});
		}
	});

	root.find("strong, b").each(() => {
		counts.strong += 1;
	});
	root.find("em, i").each(() => {
		counts.em += 1;
	});
	root.find("a[href]").each((_, element) => {
		counts.links += 1;
		const href = $(element).attr("href") || "";
		if (!href) return;
		links.push({
			href,
			text: normalizeText($(element).text()).slice(0, 120),
		});
	});
	root.find("ol").each((_, element) => {
		const firstChild = $(element).children().first();
		const heading = firstChild.find("h1,h2,h3,h4,h5,h6").first();
		if (firstChild.is("li") && heading.length > 0) {
			counts.numberedHeadings += 1;
		}
	});

	return { blocks, counts, images, links };
}

function summarizeHtml(html) {
	const $ = load(html);
	const title = normalizeText($("title").first().text());
	const bodyClass = normalizeText($("body").attr("class") || "");
	const entryContents = $(".entry-content");
	const contentContainer = $("#content").first();
	const shouldUseContentContainer =
		contentContainer.length > 0 && entryContents.length !== 1;
	const contentRoot = shouldUseContentContainer
		? contentContainer
		: entryContents.first().length > 0
			? entryContents.first()
			: contentContainer.length > 0
				? contentContainer
				: $("body");
	const contentHtml = contentRoot.html() || "";
	const contentText = normalizeText(contentRoot.text());
	const { blocks, counts, images, links } = summarizeBlocks($, contentRoot);
	const blockSequence = blocks.map((block) => block.tag);
	const sampleBlocks = blocks.slice(0, 30);
	const markdownLeak =
		/\*\*[^*]+\*\*/.test(contentText) ||
		/\[[^\]]+\]\((?:https?:\/\/|\/)/.test(contentText) ||
		/(?:^|[^a-z0-9])_[a-z][^_<]*_/.test(contentText) ||
		/\d+\\\./.test(contentText);
	const uploadLeak = /(?:src|href)="\/wp-content\/uploads\//.test(contentHtml);
	const galleryLeak = /\[gallery\b/i.test(contentHtml);
	const shortcodeLeak = /\[(?:playlist|video|audio|embed)\b/i.test(contentHtml);
	const portableTextUnknown = /data-portabletext-unknown/.test(contentHtml);
	return {
		title,
		bodyClass,
		contentText,
		contentHtml,
		blockSequence,
		sampleBlocks,
		counts,
		images,
		links,
		detectors: {
			markdownLeak,
			uploadLeak,
			galleryLeak,
			shortcodeLeak,
			portableTextUnknown,
		},
	};
}

function uniqueSorted(paths) {
	return [...new Set(paths)].sort();
}

function compareSummaries(pathname, live, preview, options, config) {
	const detectors = [];
	const textSim = similarity(live.contentText, preview.contentText);
	const lengthDelta =
		Math.abs(live.contentText.length - preview.contentText.length) /
		Math.max(1, live.contentText.length, preview.contentText.length);
	const blockSim = similarity(
		live.blockSequence.join(" "),
		preview.blockSequence.join(" "),
	);

	if (live.title !== preview.title) {
		detectors.push({
			id: "title",
			severity: "medium",
			detail: { live: live.title, preview: preview.title },
		});
	}
	if (live.bodyClass !== preview.bodyClass) {
		detectors.push({
			id: "bodyClass",
			severity: "low",
			detail: { live: live.bodyClass, preview: preview.bodyClass },
		});
	}
	if (textSim < options.textThreshold) {
		detectors.push({
			id: "textDrift",
			severity: "high",
			detail: { textSim: Number(textSim.toFixed(3)) },
		});
	}
	if (lengthDelta > options.lengthThreshold) {
		detectors.push({
			id: "lengthDrift",
			severity: "high",
			detail: { relativeLengthDelta: Number(lengthDelta.toFixed(3)) },
		});
	}
	if (blockSim < 0.95) {
		detectors.push({
			id: "blockSequence",
			severity: "high",
			detail: { blockSim: Number(blockSim.toFixed(3)) },
		});
	}
	if (live.counts.p !== preview.counts.p) {
		detectors.push({
			id: "paragraphCount",
			severity: "high",
			detail: { live: live.counts.p, preview: preview.counts.p },
		});
	}
	for (const countId of [
		"headings",
		"numberedHeadings",
		"ul",
		"ol",
		"li",
		"hr",
		"figure",
		"img",
		"video",
		"iframe",
		"sizedImages",
	]) {
		if (live.counts[countId] !== preview.counts[countId]) {
			detectors.push({
				id: `${countId}Count`,
				severity:
					countId === "hr" || countId === "sizedImages" ? "medium" : "high",
				detail: {
					live: live.counts[countId],
					preview: preview.counts[countId],
				},
			});
		}
	}
	for (const countId of ["alignleft", "alignright", "aligncenter"]) {
		if (live.counts[countId] !== preview.counts[countId]) {
			detectors.push({
				id: countId,
				severity: "medium",
				detail: {
					live: live.counts[countId],
					preview: preview.counts[countId],
				},
			});
		}
	}
	for (const detectorId of [
		"markdownLeak",
		"uploadLeak",
		"galleryLeak",
		"shortcodeLeak",
		"portableTextUnknown",
	]) {
		if (preview.detectors[detectorId]) {
			detectors.push({
				id: detectorId,
				severity: "high",
				detail: true,
			});
		}
	}

	const suppressed = [];
	const activeDetectors = detectors.filter((detector) => {
		const match = (config.suppressions ?? []).find((rule) => {
			const detectorMatch = !rule.detector || rule.detector === detector.id;
			const pathMatch =
				!rule.pathPattern || new RegExp(rule.pathPattern).test(pathname);
			return detectorMatch && pathMatch;
		});
		if (match) {
			suppressed.push({
				id: detector.id,
				reason: match.reason || "suppressed",
			});
			return false;
		}
		return true;
	});

	const severityScore = activeDetectors.reduce((total, detector) => {
		if (detector.severity === "high") return total + 5;
		if (detector.severity === "medium") return total + 3;
		return total + 1;
	}, 0);

	return {
		path: pathname,
		routeType: classifyRoute(pathname),
		textSim: Number(textSim.toFixed(3)),
		blockSim: Number(blockSim.toFixed(3)),
		lengthDelta: Number(lengthDelta.toFixed(3)),
		liveCounts: live.counts,
		previewCounts: preview.counts,
		sampleBlocks: {
			live: live.sampleBlocks.slice(0, 8),
			preview: preview.sampleBlocks.slice(0, 8),
		},
		detectors: activeDetectors,
		suppressed,
		severityScore,
	};
}

function comparePages(pathname, livePage, previewPage, options, config) {
	if (!livePage) {
		return {
			path: pathname,
			routeType: classifyRoute(pathname),
			kind: "onlyPreview",
			severityScore: 6,
			detectors: [{ id: "onlyPreview", severity: "high", detail: true }],
		};
	}
	if (!previewPage) {
		return {
			path: pathname,
			routeType: classifyRoute(pathname),
			kind: "onlyLive",
			severityScore: 6,
			detectors: [{ id: "onlyLive", severity: "high", detail: true }],
		};
	}
	if (livePage.status !== previewPage.status) {
		return {
			path: pathname,
			routeType: classifyRoute(pathname),
			kind: "statusDiff",
			severityScore: 8,
			detectors: [
				{
					id: "status",
					severity: "high",
					detail: { live: livePage.status, preview: previewPage.status },
				},
			],
		};
	}
	if (livePage.status !== 200) return null;

	const liveSummary = summarizeHtml(livePage.html);
	const previewSummary = summarizeHtml(previewPage.html);
	const comparison = compareSummaries(
		pathname,
		liveSummary,
		previewSummary,
		options,
		config,
	);
	if (comparison.detectors.length === 0 && comparison.suppressed.length === 0) {
		return null;
	}
	return {
		kind: "contentDiff",
		...comparison,
	};
}

async function createDiffPng(leftPath, rightPath, diffPath) {
	const left = PNG.sync.read(fs.readFileSync(leftPath));
	const right = PNG.sync.read(fs.readFileSync(rightPath));
	const width = Math.max(left.width, right.width);
	const height = Math.max(left.height, right.height);
	const leftCanvas = new PNG({ width, height, fill: true });
	const rightCanvas = new PNG({ width, height, fill: true });
	PNG.bitblt(left, leftCanvas, 0, 0, left.width, left.height, 0, 0);
	PNG.bitblt(right, rightCanvas, 0, 0, right.width, right.height, 0, 0);
	const diff = new PNG({ width, height });
	const diffPixels = pixelmatch(
		leftCanvas.data,
		rightCanvas.data,
		diff.data,
		width,
		height,
		{ threshold: 0.1 },
	);
	fs.writeFileSync(diffPath, PNG.sync.write(diff));
	return Number((diffPixels / Math.max(1, width * height)).toFixed(4));
}

async function captureVisualDiffs(baseLive, basePreview, diffs, options) {
	if (options.visualLimit <= 0 || diffs.length === 0) return [];
	const selected = diffs
		.filter((diff) => diff.kind === "contentDiff" || diff.kind === "statusDiff")
		.sort((a, b) => b.severityScore - a.severityScore)
		.slice(0, options.visualLimit);
	if (options.route) {
		const focusedDiff = diffs.find((diff) => diff.path === options.route);
		if (
			focusedDiff &&
			(focusedDiff.kind === "contentDiff" ||
				focusedDiff.kind === "statusDiff") &&
			!selected.some((diff) => diff.path === focusedDiff.path)
		) {
			selected.unshift(focusedDiff);
		}
	}
	if (selected.length === 0) return [];

	const browserPath = resolveBrowserPath(options.browserPath);
	if (!browserPath) {
		throw new Error(
			[
				"Visual diffs require a Chromium-based browser.",
				"Set PARITY_AUDIT_BROWSER_PATH or pass --browser-path to a local Chrome/Chromium binary.",
			].join(" "),
		);
	}
	const browser = await chromium.launch({ executablePath: browserPath });
	const livePage = await browser.newPage();
	const previewPage = await browser.newPage();
	const screenshotsDir = path.join(options.outputDir, "screenshots");
	ensureDir(screenshotsDir);
	const results = [];

	try {
		for (const diff of selected) {
			const slug = sanitizeSlug(diff.path);
			const visual = { path: diff.path, viewports: [] };
			for (const viewport of VIEWPORTS) {
				await livePage.setViewportSize({
					width: viewport.width,
					height: viewport.height,
				});
				await previewPage.setViewportSize({
					width: viewport.width,
					height: viewport.height,
				});
				const liveUrl = `${baseLive}${diff.path}`;
				const previewUrl = `${basePreview}${diff.path}`;
				await livePage.goto(liveUrl, { waitUntil: "networkidle" });
				await previewPage.goto(previewUrl, { waitUntil: "networkidle" });
				const liveShot = path.join(
					screenshotsDir,
					`${slug}-${viewport.id}-live.png`,
				);
				const previewShot = path.join(
					screenshotsDir,
					`${slug}-${viewport.id}-preview.png`,
				);
				const diffShot = path.join(
					screenshotsDir,
					`${slug}-${viewport.id}-diff.png`,
				);
				await livePage.screenshot({ path: liveShot, fullPage: true });
				await previewPage.screenshot({ path: previewShot, fullPage: true });
				const diffRatio = await createDiffPng(liveShot, previewShot, diffShot);
				visual.viewports.push({
					id: viewport.id,
					width: viewport.width,
					height: viewport.height,
					diffRatio,
					files: {
						live: path.relative(options.outputDir, liveShot),
						preview: path.relative(options.outputDir, previewShot),
						diff: path.relative(options.outputDir, diffShot),
					},
				});
			}
			results.push(visual);
		}
	} finally {
		await browser.close();
	}

	return results;
}

function renderHtmlReport(result) {
	const rows = result.diffs
		.filter((diff) => diff.kind === "contentDiff" || diff.kind === "statusDiff")
		.slice(0, 100)
		.map((diff) => {
			const visual = result.visualDiffs.find((item) => item.path === diff.path);
			const detectors = diff.detectors
				.map((detector) => `${detector.id} (${detector.severity})`)
				.join(", ");
			const visualHtml = visual
				? visual.viewports
						.map(
							(viewport) =>
								`<div><strong>${viewport.id}</strong> diff=${viewport.diffRatio}<br /><a href="${viewport.files.diff}">diff</a></div>`,
						)
						.join("")
				: "n/a";
			return `<tr>
				<td><a href="${result.options.preview}${diff.path}">${diff.path}</a></td>
				<td>${diff.routeType}</td>
				<td>${diff.severityScore}</td>
				<td>${detectors || "none"}</td>
				<td>${diff.textSim ?? ""}</td>
				<td>${diff.blockSim ?? ""}</td>
				<td>${visualHtml}</td>
			</tr>`;
		})
		.join("\n");

	return `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<title>Parity audit report</title>
	<style>
		body { font-family: Arial, sans-serif; margin: 24px; }
		table { border-collapse: collapse; width: 100%; }
		th, td { border: 1px solid #ccc; padding: 8px; vertical-align: top; text-align: left; }
		th { background: #f5f5f5; }
		code { background: #f3f3f3; padding: 2px 4px; }
	</style>
</head>
<body>
	<h1>Parity audit report</h1>
	<p><strong>Live:</strong> <code>${result.options.live}</code></p>
	<p><strong>Preview:</strong> <code>${result.options.preview}</code></p>
	<ul>
		<li>Seed routes: ${result.seedRouteCount}</li>
		<li>Crawled live: ${result.crawledLive}</li>
		<li>Crawled preview: ${result.crawledPreview}</li>
		<li>Diffs found: ${result.diffs.length}</li>
		<li>Visual diffs captured: ${result.visualDiffs.length}</li>
	</ul>
	<table>
		<thead>
			<tr>
				<th>Path</th>
				<th>Route type</th>
				<th>Severity</th>
				<th>Detectors</th>
				<th>Text sim</th>
				<th>Block sim</th>
				<th>Visual</th>
			</tr>
		</thead>
		<tbody>${rows}</tbody>
	</table>
</body>
</html>`;
}

function summarize(result) {
	const detectorCounts = new Map();
	for (const diff of result.diffs) {
		for (const detector of diff.detectors ?? []) {
			detectorCounts.set(
				detector.id,
				(detectorCounts.get(detector.id) ?? 0) + 1,
			);
		}
	}
	console.log(`Seed routes: ${result.seedRouteCount}`);
	console.log(`Crawled live: ${result.crawledLive}`);
	console.log(`Crawled preview: ${result.crawledPreview}`);
	console.log(`Diffs found: ${result.diffs.length}`);
	console.log(`Visual diffs: ${result.visualDiffs.length}`);
	console.log("\nTop detectors:");
	for (const [id, count] of [...detectorCounts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 12)) {
		console.log(`- ${id}: ${count}`);
	}
	console.log("\nTop routes:");
	for (const diff of result.diffs.slice(0, 12)) {
		console.log(
			`- ${diff.path} score=${diff.severityScore} detectors=${diff.detectors.map((detector) => detector.id).join(",")}`,
		);
	}
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const config = readConfig(options.configPath);
	ensureDir(options.outputDir);

	const starts = options.route ? [options.route] : getSeedRoutes();
	const crawlOptions = {
		followLinks: !options.route,
	};
	const livePages = await crawl(
		options.live,
		starts,
		options.limit,
		options.concurrency,
		crawlOptions,
	);
	const previewPages = await crawl(
		options.preview,
		starts,
		options.limit,
		options.concurrency,
		crawlOptions,
	);
	const allPaths = uniqueSorted([...livePages.keys(), ...previewPages.keys()]);
	const diffs = allPaths
		.map((pathname) =>
			comparePages(
				pathname,
				livePages.get(pathname),
				previewPages.get(pathname),
				options,
				config,
			),
		)
		.filter(Boolean)
		.sort(
			(a, b) =>
				b.severityScore - a.severityScore || a.path.localeCompare(b.path),
		);

	const visualDiffs = await captureVisualDiffs(
		options.live,
		options.preview,
		diffs,
		options,
	);

	const result = {
		options,
		seedRouteCount: starts.length,
		crawledLive: livePages.size,
		crawledPreview: previewPages.size,
		diffs,
		visualDiffs,
	};
	const jsonPath = path.join(options.outputDir, "report.json");
	const htmlPath = path.join(options.outputDir, "report.html");
	fs.writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`);
	fs.writeFileSync(htmlPath, renderHtmlReport(result));
	summarize(result);
	console.log(`\nJSON report: ${jsonPath}`);
	console.log(`HTML report: ${htmlPath}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
