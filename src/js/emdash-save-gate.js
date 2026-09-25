const CONTENT_SAVE_PATH_RE = /^\/_emdash\/api\/content\/[^/]+\/[^/]+$/;
const VISUAL_PUBLISH_PATH_RE =
	/^\/_emdash\/api\/visual-editing\/content\/[^/]+\/[^/]+\/publish$/;
const SAVE_SETTLE_TIMEOUT_MS = 15000;

const pendingContentSaves = new Set();
let hasUnsavedInlineChanges = false;
let lastSaveError = null;

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isContentRequest(input, init, expectedMethod, pathPattern) {
	const method = (
		init?.method || (input instanceof Request ? input.method : "GET")
	).toUpperCase();
	if (method !== expectedMethod) return false;

	const rawUrl = input instanceof Request ? input.url : String(input);
	const url = new URL(rawUrl, window.location.href);
	return (
		url.origin === window.location.origin && pathPattern.test(url.pathname)
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
		const isContentSave = isContentRequest(
			input,
			init,
			"PUT",
			CONTENT_SAVE_PATH_RE,
		);
		const responsePromise = originalFetch(input, init);
		if (isContentRequest(input, init, "POST", VISUAL_PUBLISH_PATH_RE)) {
			return responsePromise.catch((error) => {
				// EmDash surfaces HTTP failures, but only logs rejected publish fetches.
				dispatchSaveState("error");
				throw error;
			});
		}
		return isContentSave ? trackContentSave(responsePromise) : responsePromise;
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
	// Only a new save can clear a failure: no request may also mean a refused
	// blur save already settled. EmDash does not acknowledge clean undo state.
	blurActiveEditor();
	await waitForSaveToStart();

	if (expectedSave && pendingContentSaves.size === 0) {
		await sleep(250);
	}

	await waitForPendingContentSaves();
}

function replacePage() {
	if (document.startViewTransition) {
		document.startViewTransition(() => location.replace(location.href));
	} else {
		location.replace(location.href);
	}
}

async function publishAfterSave(button) {
	const previousText = button.textContent;
	button.disabled = true;
	button.textContent = "Saving...";

	try {
		await flushInlineSaves();
		button.disabled = false;
		button.textContent = previousText;
		// The gate is now clear. Let EmDash own the action token, errors, and reload.
		button.click();
	} catch (error) {
		button.disabled = false;
		button.textContent = previousText || "Publish";
		dispatchSaveState("error");
		console.error("Unable to publish after inline save:", error);
	}
}

function shouldGateToolbarAction() {
	return hasUnsavedInlineChanges || pendingContentSaves.size > 0;
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
			if (!shouldGateToolbarAction()) return;
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
			if (!shouldGateToolbarAction()) return;
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
