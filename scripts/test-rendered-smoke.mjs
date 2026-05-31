#!/usr/bin/env node

import fs from "node:fs";
import { createServer } from "node:http";
import process from "node:process";

import { chromium } from "playwright";

const DEFAULT_PATHS = {
	about: "/about/",
	centeredImage: "/2021/10/19/timothy-stock/",
	gallery: "/about-ce-projects/about-e-portfolios/",
	sitemap: "/sitemap/",
	taxonomy: "/topic/organize-an-activity/",
	video: "/project/3119/",
	youtube: "/the-ethics-of-psytrance/",
	saveGate: "/emdash-save-gate/",
	saveGateInactive: "/emdash-save-gate-inactive/",
};

const DEFAULTS = {
	base: "",
	browserPath: process.env.RENDERED_SMOKE_BROWSER_PATH || "",
	headed: false,
	timeout: 12000,
};

const SAVE_GATE_SCRIPT = fs.readFileSync(
	new URL("../src/js/emdash-save-gate.js", import.meta.url),
	"utf8",
);

function parseArgs(argv) {
	const options = { ...DEFAULTS };
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		const next = argv[i + 1];
		if (arg === "--base" && next) {
			options.base = next;
			i += 1;
		} else if (arg === "--browser-path" && next) {
			options.browserPath = next;
			i += 1;
		} else if (arg === "--headed") {
			options.headed = true;
		} else if (arg === "--timeout" && next) {
			options.timeout = Number(next);
			i += 1;
		}
	}
	return options;
}

function resolveBrowserPath(preferredPath) {
	const candidates = [
		preferredPath,
		process.env.RENDERED_SMOKE_BROWSER_PATH,
		"/usr/bin/google-chrome",
		"/usr/bin/chromium",
		"/usr/bin/chromium-browser",
	].filter(Boolean);
	return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

function normalizePath(pathname) {
	const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
	return normalized === "/" || normalized.endsWith("/")
		? normalized
		: `${normalized}/`;
}

function fixtureShell(title, body) {
	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>${title} - Engaged Philosophy</title>
		<style>
			body { margin: 0; font-family: system-ui, sans-serif; line-height: 1.5; }
			.container { max-width: 960px; margin: 0 auto; padding: 16px; }
			.navbar-toggler { display: inline-flex; min-width: 44px; min-height: 44px; }
			.collapse { display: none; }
			.collapse.show { display: block; }
			.entry-content::after { clear: both; content: ""; display: table; }
			.aligncenter { display: block; margin: 0 auto 20px; }
			.emdash-image.aligncenter { display: table; max-width: 100%; margin-right: auto; margin-left: auto; }
			.emdash-image.aligncenter > figcaption { display: table-caption; caption-side: bottom; }
			.legacy-image--rounded img, img.legacy-image--rounded { border-radius: 9999px; }
			.alignleft { float: left; margin: 0 20px 20px 0; }
			.alignright { float: right; margin: 0 0 20px 20px; }
			.legacy-gallery { margin: 0 0 20px; }
			.legacy-gallery-shortcode { display: grid; gap: 20px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
			.legacy-gallery.blocks-gallery-grid, .legacy-gallery .blocks-gallery-grid { display: flex; flex-wrap: wrap; gap: 20px; padding-left: 0; list-style: none; margin: 0; }
			.legacy-gallery .blocks-gallery-item { flex: 1 1 300px; margin: 0; }
			.legacy-video video { display: block; max-width: 100%; width: 100%; }
			.legacy-embed__frame { aspect-ratio: 16 / 9; position: relative; width: 100%; }
			.legacy-embed__frame iframe { border: 0; height: 100%; inset: 0; position: absolute; width: 100%; }
		</style>
	</head>
	<body>
		<div class="container">
			<nav id="access" aria-label="Main navigation">
				<div class="navbar navbar-expand-lg navbar-dark bg-dark">
					<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
						<span class="navbar-toggler-icon"></span>
					</button>
					<div class="collapse navbar-collapse" id="navbarNav">
						<ul id="menu-main-menu" class="navbar-nav ms-auto">
							<li class="menu-item nav-item"><a class="nav-link" href="/about/">About</a></li>
							<li class="menu-item nav-item"><a class="nav-link" href="/project/">Projects</a></li>
						</ul>
					</div>
				</div>
			</nav>
			<main id="content">${body}</main>
		</div>
		<script>
			document.addEventListener("click", (event) => {
				const button = event.target.closest("[data-bs-toggle='collapse']");
				if (!button) return;
				const target = document.querySelector(button.getAttribute("data-bs-target"));
				if (!target) return;
				target.classList.toggle("show");
				button.setAttribute("aria-expanded", target.classList.contains("show") ? "true" : "false");
			});
		</script>
	</body>
</html>`;
}

function saveGateFixtureShell() {
	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Save Gate - Engaged Philosophy</title>
	</head>
	<body>
		<div id="emdash-toolbar" data-edit-mode="true">
			<input type="checkbox" id="emdash-edit-toggle" checked />
			<span id="emdash-tb-status"></span>
			<span id="emdash-tb-save-status"></span>
			<button id="emdash-tb-publish" type="button">Publish</button>
		</div>
		<main>
			<article data-emdash-ref='{"collection":"pages","id":"about","status":"published","hasDraft":true}'>
				<div id="editor" class="emdash-inline-editor" contenteditable="true">Original content</div>
			</article>
		</main>
		<script>${SAVE_GATE_SCRIPT}</script>
		<script>
			const editor = document.getElementById("editor");
			let originalValue = editor.textContent;

			editor.addEventListener("input", () => {
				document.dispatchEvent(new CustomEvent("emdash:save", { detail: { state: "unsaved" } }));
			});

			editor.addEventListener("blur", () => {
				if (editor.textContent === originalValue) return;
				fetch("/_emdash/api/content/pages/about", {
					method: "PUT",
					credentials: "same-origin",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ data: { content: editor.textContent } }),
				}).then((response) => {
					if (response.ok) {
						originalValue = editor.textContent;
						document.dispatchEvent(new CustomEvent("emdash:save", { detail: { state: "saved" } }));
					} else {
						document.dispatchEvent(new CustomEvent("emdash:save", { detail: { state: "error" } }));
					}
				}).catch(() => {
					document.dispatchEvent(new CustomEvent("emdash:save", { detail: { state: "error" } }));
				});
			});

			document.getElementById("emdash-tb-publish").onclick = () => {
				window.__originalPublishHandlerRan = true;
				fetch("/_emdash/api/content/pages/about/publish", {
					method: "POST",
					credentials: "same-origin",
					headers: { "X-EmDash-Request": "1" },
				});
			};

			document.getElementById("emdash-edit-toggle").addEventListener("change", () => {
				window.__originalToggleHandlerRan = true;
				location.replace(location.href);
			});
		</script>
	</body>
</html>`;
}

function inactiveSaveGateFixtureShell() {
	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Inactive Save Gate - Engaged Philosophy</title>
	</head>
	<body>
		<div id="emdash-toolbar" data-edit-mode="false">
			<input type="checkbox" id="emdash-edit-toggle" />
			<span id="emdash-tb-status"></span>
			<span id="emdash-tb-save-status"></span>
			<button id="emdash-tb-publish" type="button">Publish</button>
		</div>
		<main>
			<article data-emdash-ref='{"collection":"pages","id":"about","status":"published","hasDraft":false}'>
				<p>View mode content.</p>
			</article>
		</main>
		<script>${SAVE_GATE_SCRIPT}</script>
	</body>
</html>`;
}

const FIXTURES = {
	[DEFAULT_PATHS.about]: fixtureShell(
		"About",
		`<article>
			<h1 class="entry-title">About</h1>
			<div class="entry-content">
				<figure class="alignleft"><img src="/media/about.jpg" alt="Students" width="220" height="160" /></figure>
				<p>Engaged Philosophy is a community of teachers, students, and organizers working together through public philosophy.</p>
				<p>This text should wrap beside the floated image on wider screens and continue below it as needed.</p>
			</div>
		</article>`,
	),
	[DEFAULT_PATHS.gallery]: fixtureShell(
		"About E-Portfolios",
		`<article>
			<h1 class="entry-title">About E-Portfolios</h1>
			<div class="entry-content">
				<div class="legacy-gallery legacy-gallery-shortcode legacy-gallery-columns-3">
					<a class="gallery-item" href="/media/gallery-1.jpg"><img src="/media/gallery-1.jpg" alt="Gallery item 1" /></a>
					<a class="gallery-item" href="/media/gallery-2.jpg"><img src="/media/gallery-2.jpg" alt="Gallery item 2" /></a>
					<a class="gallery-item" href="/media/gallery-3.jpg"><img src="/media/gallery-3.jpg" alt="Gallery item 3" /></a>
				</div>
			</div>
		</article>`,
	),
	[DEFAULT_PATHS.centeredImage]: fixtureShell(
		"Timothy Stock",
		`<article>
			<h1 class="entry-title">Timothy Stock</h1>
			<div class="entry-content">
				<figure class="emdash-image aligncenter legacy-image--rounded">
					<a href="/media/stock.jpg"><img src="/media/stock.jpg" alt="Timothy Stock" width="404" height="553" /></a>
					<figcaption>The author, Timothy Stock.</figcaption>
				</figure>
			</div>
		</article>`,
	),
	[DEFAULT_PATHS.sitemap]: fixtureShell(
		"Sitemap",
		`<article>
			<h1 class="entry-title">Sitemap</h1>
			<div class="entry-content">
				<ul class="legacy-page-list">
					<li><a href="/about/">About</a></li>
					<li><a href="/project/">Projects</a></li>
				</ul>
			</div>
		</article>`,
	),
	[DEFAULT_PATHS.taxonomy]: fixtureShell(
		"Organize an Activity",
		`<section id="primary">
			<header class="page-header"><h1 class="page-title">Project Topic: <span>Organize an Activity</span></h1></header>
			<article class="project type-project status-publish">
				<header class="page-header mb-3"><h2 class="entry-title h4 mb-0">Community Dialogue</h2></header>
				<div class="entry-content"><p>A project excerpt. <a href="/project/community-dialogue/">Continue reading</a></p></div>
			</article>
		</section>`,
	),
	[DEFAULT_PATHS.video]: fixtureShell(
		"Project 3119",
		`<article>
			<h1 class="entry-title">Project 3119</h1>
			<div class="entry-content">
				<figure class="legacy-video">
					<video controls preload="metadata" playsinline>
						<source src="/media/project-3119.mp4" type="video/mp4" />
						<a href="/media/project-3119.mp4">Project video</a>
					</video>
				</figure>
			</div>
		</article>`,
	),
	[DEFAULT_PATHS.youtube]: fixtureShell(
		"The Ethics of Psytrance",
		`<article>
			<h1 class="entry-title">The Ethics of Psytrance</h1>
			<div class="entry-content">
				<figure class="legacy-embed legacy-embed--youtube">
					<div class="legacy-embed__frame">
						<iframe src="https://www.youtube.com/embed/67-3Jr2QWcg" title="Embedded media" allowfullscreen></iframe>
					</div>
				</figure>
			</div>
		</article>`,
	),
};

async function createFixtureServer() {
	const apiEvents = [];
	const server = createServer((request, response) => {
		const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
		const pathname = normalizePath(requestUrl.pathname);
		if (pathname === DEFAULT_PATHS.saveGate) {
			apiEvents.push({ type: "page", time: Date.now() });
			response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
			response.end(saveGateFixtureShell());
			return;
		}
		if (pathname === DEFAULT_PATHS.saveGateInactive) {
			response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
			response.end(inactiveSaveGateFixtureShell());
			return;
		}
		if (
			request.method === "PUT" &&
			requestUrl.pathname === "/_emdash/api/content/pages/about"
		) {
			apiEvents.push({ type: "save-start", time: Date.now() });
			request.resume();
			request.on("end", () => {
				setTimeout(() => {
					apiEvents.push({ type: "save-finish", time: Date.now() });
					response.writeHead(200, {
						"content-type": "application/json; charset=utf-8",
					});
					response.end(JSON.stringify({ success: true }));
				}, 400);
			});
			return;
		}
		if (
			request.method === "POST" &&
			requestUrl.pathname === "/_emdash/api/content/pages/about/publish"
		) {
			apiEvents.push({ type: "publish-start", time: Date.now() });
			request.resume();
			response.writeHead(200, {
				"content-type": "application/json; charset=utf-8",
			});
			response.end(JSON.stringify({ success: true }));
			return;
		}
		const html = FIXTURES[pathname];
		if (!html) {
			response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
			response.end("Not found");
			return;
		}
		response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
		response.end(html);
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	return {
		base: `http://127.0.0.1:${address.port}`,
		close: () => new Promise((resolve) => server.close(resolve)),
		getApiEvents: () => [...apiEvents],
		resetApiEvents: () => {
			apiEvents.length = 0;
		},
	};
}

async function expectVisible(page, selector, label) {
	const count = await page.locator(selector).count();
	if (count < 1) {
		throw new Error(`Missing ${label}: ${selector}`);
	}
}

async function expectNoLiteral(page, literal) {
	const pageText = await page.locator("body").innerText();
	if (pageText.includes(literal)) {
		throw new Error(`Found unmigrated shortcode literal: ${literal}`);
	}
}

async function openPage(browser, base, pathname, timeout) {
	const page = await browser.newPage();
	page.setDefaultTimeout(timeout);
	await page.goto(new URL(pathname, base).toString(), {
		timeout,
		waitUntil: "domcontentloaded",
	});
	return page;
}

async function checkAboutImageWrap(browser, base, timeout) {
	const page = await openPage(browser, base, DEFAULT_PATHS.about, timeout);
	try {
		const result = await page
			.locator(".entry-content .alignleft, .entry-content .alignright")
			.first()
			.evaluate((element) => {
				const style = getComputedStyle(element);
				return {
					floatValue: style.float,
					hasParagraph: Boolean(element.parentElement?.querySelector("p")),
				};
			});
		if (!["left", "right"].includes(result.floatValue)) {
			throw new Error(
				`Expected a floated image, got float=${result.floatValue}`,
			);
		}
		if (!result.hasParagraph) {
			throw new Error("Expected article text near the floated image");
		}
	} finally {
		await page.close();
	}
}

async function checkCenteredLegacyImage(browser, base, timeout) {
	const page = await openPage(
		browser,
		base,
		DEFAULT_PATHS.centeredImage,
		timeout,
	);
	try {
		await expectVisible(
			page,
			".entry-content .emdash-image.aligncenter img",
			"centered legacy image",
		);
		const result = await page
			.locator(".entry-content .emdash-image.aligncenter")
			.first()
			.evaluate((figure) => {
				const content = figure.closest(".entry-content");
				const image = figure.querySelector("img");
				if (!content || !image) {
					return { missing: true };
				}
				const contentBox = content.getBoundingClientRect();
				const imageBox = image.getBoundingClientRect();
				return {
					missing: false,
					contentCenter: contentBox.left + contentBox.width / 2,
					imageCenter: imageBox.left + imageBox.width / 2,
				};
			});
		if (result.missing) {
			throw new Error("Expected a centered legacy image inside entry content");
		}
		const offset = Math.abs(result.contentCenter - result.imageCenter);
		if (offset > 2) {
			throw new Error(
				`Expected centered legacy image, got ${offset.toFixed(2)}px offset`,
			);
		}
		const roundedImage = page.locator(
			".entry-content .legacy-image--rounded img",
		);
		if ((await roundedImage.count()) > 0) {
			const radius = await roundedImage
				.first()
				.evaluate((image) => getComputedStyle(image).borderTopLeftRadius);
			if (radius === "0px") {
				throw new Error("Expected rounded legacy image styling");
			}
		}
	} finally {
		await page.close();
	}
}

async function checkGalleryLayout(browser, base, timeout) {
	const page = await openPage(browser, base, DEFAULT_PATHS.gallery, timeout);
	try {
		await expectVisible(page, ".legacy-gallery img[src]", "gallery images");
		const display = await page
			.locator(
				".legacy-gallery-shortcode, .legacy-gallery.blocks-gallery-grid, .legacy-gallery .blocks-gallery-grid",
			)
			.first()
			.evaluate((element) => getComputedStyle(element).display);
		if (!["flex", "grid"].includes(display)) {
			throw new Error(
				`Expected gallery grid/flex layout, got display=${display}`,
			);
		}
		await expectNoLiteral(page, "[gallery");
	} finally {
		await page.close();
	}
}

async function checkSitemap(browser, base, timeout) {
	const page = await openPage(browser, base, DEFAULT_PATHS.sitemap, timeout);
	try {
		await expectVisible(
			page,
			".legacy-page-list a[href]",
			"sitemap page links",
		);
		await expectNoLiteral(page, "[list-pages");
	} finally {
		await page.close();
	}
}

async function checkTaxonomyArchive(browser, base, timeout) {
	const page = await openPage(browser, base, DEFAULT_PATHS.taxonomy, timeout);
	try {
		await expectVisible(page, "article.project", "project archive entries");
		await expectVisible(
			page,
			'article.project a[href^="/project/"], article.project a[href*="/project/"]',
			"project archive links",
		);
	} finally {
		await page.close();
	}
}

async function checkVideo(browser, base, timeout) {
	const page = await openPage(browser, base, DEFAULT_PATHS.video, timeout);
	try {
		await expectVisible(
			page,
			".legacy-video video source[src], .legacy-video video[src]",
			"legacy video source",
		);
		await expectNoLiteral(page, "[playlist");
	} finally {
		await page.close();
	}
}

async function checkYoutubeEmbed(browser, base, timeout) {
	const page = await openPage(browser, base, DEFAULT_PATHS.youtube, timeout);
	try {
		const src = await page
			.locator(".legacy-embed iframe[src]")
			.first()
			.getAttribute("src");
		if (!src || !/youtube(?:-nocookie)?\.com\/embed\/67-3Jr2QWcg/i.test(src)) {
			throw new Error(
				`Expected migrated YouTube embed, got ${src || "no iframe"}`,
			);
		}
		await expectNoLiteral(page, "[youtube");
	} finally {
		await page.close();
	}
}

async function checkMobileNav(browser, base, timeout) {
	const page = await openPage(browser, base, DEFAULT_PATHS.about, timeout);
	try {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.locator(".navbar-toggler").click();
		await page.locator("#navbarNav.show").waitFor({ state: "attached" });
		await page.locator(".navbar-toggler").click();
		await page.locator("#navbarNav.show").waitFor({ state: "detached" });
	} finally {
		await page.close();
	}
}

async function waitForFixtureEvent(fixture, predicate, timeout) {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeout) {
		const events = fixture.getApiEvents();
		if (predicate(events)) return events;
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	throw new Error("Timed out waiting for fixture event");
}

function assertOrderedEvents(events, expectedOrder) {
	const positions = expectedOrder.map((type) =>
		events.findIndex((event) => event.type === type),
	);
	for (const [index, position] of positions.entries()) {
		if (position < 0) {
			throw new Error(`Missing fixture event: ${expectedOrder[index]}`);
		}
		if (index > 0 && position <= positions[index - 1]) {
			throw new Error(
				`Expected event order ${expectedOrder.join(" -> ")}, got ${events
					.map((event) => event.type)
					.join(" -> ")}`,
			);
		}
	}
}

async function checkEditSaveGate(browser, base, timeout, fixture) {
	fixture.resetApiEvents();
	let page = await openPage(browser, base, DEFAULT_PATHS.saveGate, timeout);
	try {
		await page.locator("#editor").click();
		await page.keyboard.type(" changed");
		await page.locator("#emdash-tb-publish").click();
		const publishEvents = await waitForFixtureEvent(
			fixture,
			(events) => events.some((event) => event.type === "publish-start"),
			timeout,
		);
		assertOrderedEvents(publishEvents, [
			"save-start",
			"save-finish",
			"publish-start",
		]);
	} finally {
		await page.close();
	}

	fixture.resetApiEvents();
	page = await openPage(browser, base, DEFAULT_PATHS.saveGate, timeout);
	try {
		await page.locator("#editor").click();
		await page.keyboard.type(" changed");
		await page.locator("#emdash-edit-toggle").click();
		const toggleEvents = await waitForFixtureEvent(
			fixture,
			(events) => events.filter((event) => event.type === "page").length >= 2,
			timeout,
		);
		assertOrderedEvents(toggleEvents, ["save-start", "save-finish"]);
		const secondPagePosition = toggleEvents.findIndex(
			(event, index) => event.type === "page" && index > 0,
		);
		const saveFinishPosition = toggleEvents.findIndex(
			(event) => event.type === "save-finish",
		);
		if (saveFinishPosition > secondPagePosition) {
			throw new Error("Edit mode toggled before the inline save finished");
		}
	} finally {
		await page.close();
	}
}

async function checkInactiveSaveGate(browser, base, timeout) {
	const page = await openPage(
		browser,
		base,
		DEFAULT_PATHS.saveGateInactive,
		timeout,
	);
	try {
		const installed = await page.evaluate(
			() => window.__engagedPhilosophySaveGateInstalled === true,
		);
		if (installed) {
			throw new Error("Save gate installed outside active edit mode");
		}
	} finally {
		await page.close();
	}
}

async function runCheck(name, callback, failures) {
	try {
		await callback();
		console.log(`ok - ${name}`);
	} catch (error) {
		failures.push({ name, error });
		console.error(`not ok - ${name}`);
		console.error(error instanceof Error ? error.message : String(error));
	}
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const fixture = options.base ? null : await createFixtureServer();
	const base = (options.base || fixture.base).replace(/\/$/, "");
	const browserPath = resolveBrowserPath(options.browserPath);
	const browser = await chromium.launch({
		args: ["--no-sandbox"],
		executablePath: browserPath || undefined,
		headless: !options.headed,
	});
	const failures = [];

	console.log(`Rendered smoke base: ${base}`);
	await runCheck(
		"about page keeps floated image wrapping",
		() => checkAboutImageWrap(browser, base, options.timeout),
		failures,
	);
	await runCheck(
		"centered legacy images align with content",
		() => checkCenteredLegacyImage(browser, base, options.timeout),
		failures,
	);
	await runCheck(
		"gallery pages render as grids",
		() => checkGalleryLayout(browser, base, options.timeout),
		failures,
	);
	await runCheck(
		"sitemap shortcode renders as links",
		() => checkSitemap(browser, base, options.timeout),
		failures,
	);
	await runCheck(
		"taxonomy archives render project listings",
		() => checkTaxonomyArchive(browser, base, options.timeout),
		failures,
	);
	await runCheck(
		"project video shortcode renders video",
		() => checkVideo(browser, base, options.timeout),
		failures,
	);
	await runCheck(
		"youtube shortcode renders iframe embed",
		() => checkYoutubeEmbed(browser, base, options.timeout),
		failures,
	);
	await runCheck(
		"mobile nav collapse toggles",
		() => checkMobileNav(browser, base, options.timeout),
		failures,
	);
	if (fixture) {
		await runCheck(
			"edit toolbar waits for inline saves",
			() => checkEditSaveGate(browser, base, options.timeout, fixture),
			failures,
		);
		await runCheck(
			"save gate stays inactive outside edit mode",
			() => checkInactiveSaveGate(browser, base, options.timeout),
			failures,
		);
	}

	await browser.close();
	if (fixture) await fixture.close();

	if (failures.length > 0) {
		console.error(
			`${failures.length} rendered smoke check${failures.length === 1 ? "" : "s"} failed.`,
		);
		process.exitCode = 1;
		return;
	}
	console.log("Rendered smoke checks passed.");
}

await main();
