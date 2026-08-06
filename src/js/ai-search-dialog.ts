interface AISearchChunk {
	item: {
		key: string;
		metadata: {
			title: string;
			description?: string;
		};
	};
}

interface AISearchResponse {
	success: boolean;
	result?: {
		chunks?: AISearchChunk[];
	};
}

const SEARCH_DEBOUNCE_MS = 600;
const SEARCH_RESULT_LIMIT = 8;
const MINIMUM_QUERY_LENGTH = 2;

function requiredElement<T extends Element>(
	root: Document | HTMLDialogElement,
	selector: string,
): T {
	const element = root.querySelector<T>(selector);
	if (!element) throw new Error(`Missing AI search element: ${selector}`);
	return element;
}

function resultUrl(value: string): URL | null {
	try {
		const url = new URL(value, window.location.origin);
		return url.origin === window.location.origin ? url : null;
	} catch {
		return null;
	}
}

function renderResults(container: HTMLOListElement, chunks: AISearchChunk[]) {
	container.replaceChildren();

	for (const chunk of chunks) {
		const url = resultUrl(chunk.item.key);
		if (!url) continue;

		const item = document.createElement("li");
		const link = document.createElement("a");
		const title = document.createElement("strong");
		const description = document.createElement("span");
		const path = document.createElement("small");

		link.href = `${url.pathname}${url.search}${url.hash}`;
		title.textContent = chunk.item.metadata.title;
		description.textContent = chunk.item.metadata.description ?? "";
		path.textContent = url.pathname;

		link.appendChild(title);
		if (description.textContent) link.appendChild(description);
		link.appendChild(path);
		item.appendChild(link);
		container.appendChild(item);
	}
}

function initializeAISearch(dialog: HTMLDialogElement) {
	if (dialog.dataset.aiSearchReady === "true") return;
	dialog.dataset.aiSearchReady = "true";

	const trigger = requiredElement<HTMLButtonElement>(
		document,
		`[data-ai-search-open][aria-controls="${dialog.id}"]`,
	);
	const input = requiredElement<HTMLInputElement>(
		dialog,
		"[data-ai-search-query]",
	);
	const status = requiredElement<HTMLElement>(
		dialog,
		"[data-ai-search-status]",
	);
	const results = requiredElement<HTMLOListElement>(
		dialog,
		"[data-ai-search-results]",
	);
	const fallback = requiredElement<HTMLAnchorElement>(
		dialog,
		"[data-ai-search-fallback]",
	);
	const apiUrl = dialog.dataset.apiUrl ?? "";
	if (!apiUrl) throw new Error("Missing AI search API URL");

	let debounce: number | undefined;
	let activeRequest: AbortController | undefined;

	function resetRequest() {
		window.clearTimeout(debounce);
		activeRequest?.abort();
		activeRequest = undefined;
	}

	async function search(query: string) {
		activeRequest = new AbortController();
		status.textContent = "Searching...";
		results.replaceChildren();

		try {
			const response = await fetch(apiUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					messages: [{ role: "user", content: query }],
					ai_search_options: {
						retrieval: { max_num_results: SEARCH_RESULT_LIMIT },
					},
				}),
				signal: activeRequest.signal,
			});
			const body = (await response.json()) as AISearchResponse;
			if (!response.ok || !body.success) throw new Error("AI search failed");

			const chunks = body.result?.chunks ?? [];
			renderResults(results, chunks);
			status.textContent =
				chunks.length === 0
					? "No related content found."
					: `${chunks.length} related result${chunks.length === 1 ? "" : "s"}.`;
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") return;
			status.textContent =
				"AI search is temporarily unavailable. Try conventional search instead.";
		}
	}

	trigger.addEventListener("click", () => {
		dialog.showModal();
		input.focus();
	});

	input.addEventListener("input", () => {
		resetRequest();
		const query = input.value.trim();
		fallback.href = query ? `/?s=${encodeURIComponent(query)}` : "/";

		if (query.length < MINIMUM_QUERY_LENGTH) {
			results.replaceChildren();
			status.textContent = "Enter at least two characters to search.";
			return;
		}

		debounce = window.setTimeout(() => void search(query), SEARCH_DEBOUNCE_MS);
	});

	dialog.addEventListener("close", resetRequest);
}

document
	.querySelectorAll<HTMLDialogElement>("[data-ai-search-dialog]")
	.forEach(initializeAISearch);
