#!/usr/bin/env node

import fs from "node:fs";
import { createServer } from "node:http";
import process from "node:process";

import { chromium } from "playwright";

const DEFAULT_PATHS = {
	about: "/about/",
	gallery: "/about-ce-projects/about-e-portfolios/",
	sitemap: "/sitemap/",
	taxonomy: "/topic/organize-an-activity/",
	video: "/project/3119/",
	youtube: "/the-ethics-of-psytrance/",
};

const DEFAULTS = {
	base: "",
	browserPath: process.env.RENDERED_SMOKE_BROWSER_PATH || "",
	headed: false,
	timeout: 12000,
};

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
	const server = createServer((request, response) => {
		const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
		const pathname = normalizePath(requestUrl.pathname);
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
