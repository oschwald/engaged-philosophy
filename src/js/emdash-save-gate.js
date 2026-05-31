const CONTENT_SAVE_PATH_RE = /^\/_emdash\/api\/content\/[^/]+\/[^/]+$/;
const SAVE_SETTLE_TIMEOUT_MS = 15000;

const pendingContentSaves = new Set();
let hasUnsavedInlineChanges = false;
let lastSaveError = null;

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isContentSaveRequest(input, init) {
	const method = (
		init?.method || (input instanceof Request ? input.method : "GET")
	).toUpperCase();
	if (method !== "PUT") return false;

	const rawUrl = input instanceof Request ? input.url : String(input);
	const url = new URL(rawUrl, window.location.href);
	return (
		url.origin === window.location.origin &&
		CONTENT_SAVE_PATH_RE.test(url.pathname)
	);
}

function trackContentSave(promise) {
	lastSaveError = null;
	const tracked = promise
		.then((response) => {
			if (!response.ok) {
				lastSaveError = new Error(`Save failed: ${response.status}`);
			}
			return response;
		})
		.catch((error) => {
			lastSaveError = error;
			throw error;
		})
		.finally(() => {
			pendingContentSaves.delete(tracked);
		});

	pendingContentSaves.add(tracked);
	return tracked;
}

function installFetchTracker() {
	if (window.__engagedPhilosophySaveGateInstalled) return;
	window.__engagedPhilosophySaveGateInstalled = true;

	const originalFetch = window.fetch.bind(window);
	window.fetch = (input, init) => {
		const responsePromise = originalFetch(input, init);
		return isContentSaveRequest(input, init)
			? trackContentSave(responsePromise)
			: responsePromise;
	};
}

function dispatchSaveState(state) {
	document.dispatchEvent(new CustomEvent("emdash:save", { detail: { state } }));
}

function blurActiveEditor() {
	const active = document.activeElement;
	if (!(active instanceof HTMLElement)) return;
	if (
		active.isContentEditable ||
		active.hasAttribute("data-emdash-editing") ||
		active.closest(".emdash-inline-editor")
	) {
		active.blur();
	}
}

async function waitForSaveToStart() {
	await new Promise((resolve) => requestAnimationFrame(resolve));
	await sleep(0);
}

async function waitForPendingContentSaves() {
	const start = Date.now();

	while (pendingContentSaves.size > 0) {
		const remaining = SAVE_SETTLE_TIMEOUT_MS - (Date.now() - start);
		if (remaining <= 0) {
			throw new Error("Timed out waiting for edits to save");
		}

		const timeout = sleep(remaining).then(() => {
			throw new Error("Timed out waiting for edits to save");
		});
		await Promise.race([Promise.allSettled([...pendingContentSaves]), timeout]);
	}

	if (lastSaveError) throw lastSaveError;
	hasUnsavedInlineChanges = false;
}

async function flushInlineSaves() {
	const expectedSave = hasUnsavedInlineChanges;
	lastSaveError = null;
	blurActiveEditor();
	await waitForSaveToStart();

	if (expectedSave && pendingContentSaves.size === 0) {
		await sleep(250);
	}

	if (expectedSave && pendingContentSaves.size === 0) {
		throw new Error("No save started for the current inline edit");
	}

	await waitForPendingContentSaves();
}

function getCurrentEntryRef() {
	const annotated = document.querySelector("[data-emdash-ref]");
	if (!annotated) return null;

	try {
		const ref = JSON.parse(annotated.getAttribute("data-emdash-ref") || "{}");
		return ref.collection && ref.id ? ref : null;
	} catch {
		return null;
	}
}

function reloadPage() {
	if (document.startViewTransition) {
		document.startViewTransition(() => location.reload());
	} else {
		location.reload();
	}
}

function replacePage() {
	if (document.startViewTransition) {
		document.startViewTransition(() => location.replace(location.href));
	} else {
		location.replace(location.href);
	}
}

async function publishAfterSave(button) {
	const ref = getCurrentEntryRef();
	if (!ref) return;

	const previousText = button.textContent;
	button.disabled = true;
	button.textContent = "Saving...";

	try {
		await flushInlineSaves();
		button.textContent = "Publishing...";

		const response = await fetch(
			`/_emdash/api/content/${encodeURIComponent(ref.collection)}/${encodeURIComponent(ref.id)}/publish`,
			{
				method: "POST",
				credentials: "same-origin",
				headers: { "X-EmDash-Request": "1" },
			},
		);

		if (!response.ok) throw new Error(`Publish failed: ${response.status}`);
		reloadPage();
	} catch (error) {
		button.disabled = false;
		button.textContent = previousText || "Publish";
		dispatchSaveState("error");
		console.error("Unable to publish after inline save:", error);
	}
}

async function toggleEditModeAfterSave(toggle) {
	const nextChecked = toggle.checked;
	const previousChecked = !nextChecked;
	toggle.disabled = true;

	try {
		await flushInlineSaves();
		if (nextChecked) {
			document.cookie = "emdash-edit-mode=true;path=/;samesite=lax";
		} else {
			document.cookie =
				"emdash-edit-mode=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT";
		}
		replacePage();
	} catch (error) {
		toggle.checked = previousChecked;
		toggle.disabled = false;
		dispatchSaveState("error");
		console.error("Unable to toggle edit mode after inline save:", error);
	}
}

function installToolbarGuards() {
	document.addEventListener(
		"emdash:save",
		(event) => {
			const state = event.detail?.state;
			if (state === "unsaved") hasUnsavedInlineChanges = true;
			if (state === "saved") hasUnsavedInlineChanges = false;
		},
		true,
	);

	document.addEventListener(
		"click",
		(event) => {
			const button = event.target?.closest?.("#emdash-tb-publish");
			if (!button) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			void publishAfterSave(button);
		},
		true,
	);

	document.addEventListener(
		"change",
		(event) => {
			const toggle = event.target;
			if (
				!(toggle instanceof HTMLInputElement) ||
				toggle.id !== "emdash-edit-toggle"
			) {
				return;
			}
			event.preventDefault();
			event.stopImmediatePropagation();
			void toggleEditModeAfterSave(toggle);
		},
		true,
	);
}

function hasActiveEditingUi() {
	return Boolean(
		document.querySelector(
			[
				'#emdash-toolbar[data-edit-mode="true"]',
				'#emdash-playground-toolbar[data-edit-mode="true"]',
				".emdash-inline-editor",
				"[data-emdash-editing]",
			].join(", "),
		),
	);
}

function installSaveGateWhenEditing() {
	if (!hasActiveEditingUi()) return;
	installFetchTracker();
	installToolbarGuards();
}

if (typeof window !== "undefined") {
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", installSaveGateWhenEditing, {
			once: true,
		});
	} else {
		installSaveGateWhenEditing();
	}
}
