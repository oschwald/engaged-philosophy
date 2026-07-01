const CLOUDFLARE_API_BASE_URL = "https://api.cloudflare.com/client/v4";
const CLOUDFLARE_DASHBOARD_BASE_URL = "https://dash.cloudflare.com";
const CLOUDFLARE_ACCESS_TIMEOUT_MS = 10_000;
const LIST_ITEMS_PER_PAGE = 1000;

interface CloudflareApiResponse<T> {
	success?: boolean;
	result?: T;
	result_info?: {
		page?: number;
		count?: number;
		per_page?: number;
		total_count?: number;
	};
	errors?: Array<{ code?: number; message?: string }>;
}

interface CloudflareZeroTrustList {
	id?: string;
	name?: string;
	type?: string;
	items?: CloudflareZeroTrustListItem[];
}

interface CloudflareZeroTrustListItem {
	value?: string;
}

export interface CloudflareAccessEmailListConfig {
	accountId?: string;
	listId?: string;
	apiToken?: string;
}

export type CloudflareAccessEmailListSyncStatus =
	"added" | "already_present" | "not_configured";

export interface CloudflareAccessEmailListSyncResult {
	status: CloudflareAccessEmailListSyncStatus;
	dashboardUrl: string;
}

interface ResolvedCloudflareAccessEmailListConfig {
	accountId: string;
	listId: string;
	apiToken: string;
}

export class CloudflareAccessEmailListConfigError extends Error {
	readonly missing: string[];

	constructor(missing: string[]) {
		super(
			`Cloudflare Access email list sync is partially configured. Missing: ${missing.join(", ")}.`,
		);
		this.name = "CloudflareAccessEmailListConfigError";
		this.missing = missing;
	}
}

export class CloudflareAccessEmailListApiError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CloudflareAccessEmailListApiError";
	}
}

function cleanConfigValue(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function resolveConfig(
	config: CloudflareAccessEmailListConfig,
): ResolvedCloudflareAccessEmailListConfig | null {
	const accountId = cleanConfigValue(config.accountId);
	const listId = cleanConfigValue(config.listId);
	const apiToken = cleanConfigValue(config.apiToken);
	const missing: string[] = [];
	if (!listId && !apiToken) return null;
	if (!accountId) missing.push("CLOUDFLARE_ACCESS_INVITE_ACCOUNT_ID");
	if (!listId) missing.push("CLOUDFLARE_ACCESS_INVITE_EMAIL_LIST_ID");
	if (!apiToken) {
		missing.push("CLOUDFLARE_ACCESS_INVITE_EMAIL_LIST_API_TOKEN");
	}

	if (missing.length > 0) {
		throw new CloudflareAccessEmailListConfigError(missing);
	}

	return {
		accountId: accountId as string,
		listId: listId as string,
		apiToken: apiToken as string,
	};
}

export function getCloudflareAccessEmailListDashboardUrl(
	accountId?: string,
): string {
	const cleanAccountId = cleanConfigValue(accountId);
	if (!cleanAccountId) return CLOUDFLARE_DASHBOARD_BASE_URL;

	return `${CLOUDFLARE_DASHBOARD_BASE_URL}/${encodeURIComponent(
		cleanAccountId,
	)}/zero-trust/lists`;
}

function getCloudflareAccessEmailListApiUrl(
	config: ResolvedCloudflareAccessEmailListConfig,
): string {
	return `${CLOUDFLARE_API_BASE_URL}/accounts/${encodeURIComponent(
		config.accountId,
	)}/gateway/lists/${encodeURIComponent(config.listId)}`;
}

function getCloudflareAccessEmailListItemsApiUrl(
	config: ResolvedCloudflareAccessEmailListConfig,
	page: number,
): string {
	const url = new URL(`${getCloudflareAccessEmailListApiUrl(config)}/items`);
	url.searchParams.set("page", String(page));
	url.searchParams.set("per_page", String(LIST_ITEMS_PER_PAGE));
	return url.toString();
}

async function readCloudflareResponse<T>(
	response: Response,
	action: string,
): Promise<CloudflareApiResponse<T> & { result: T }> {
	let body: CloudflareApiResponse<T>;
	try {
		body = (await response.json()) as CloudflareApiResponse<T>;
	} catch {
		throw new CloudflareAccessEmailListApiError(
			`Cloudflare Zero Trust email list ${action} failed with HTTP ${response.status}.`,
		);
	}

	if (!response.ok || body.success !== true || body.result === undefined) {
		const details =
			body.errors
				?.map((error) => error.message)
				.filter(Boolean)
				.join("; ") || `HTTP ${response.status}`;

		throw new CloudflareAccessEmailListApiError(
			`Cloudflare Zero Trust email list ${action} failed: ${details}.`,
		);
	}

	return body as CloudflareApiResponse<T> & { result: T };
}

async function fetchCloudflare(
	url: string,
	init: RequestInit,
	action: string,
	signal: AbortSignal,
	fetchImpl: typeof fetch,
): Promise<Response> {
	try {
		return await fetchImpl(url, { ...init, signal });
	} catch (error) {
		if (
			signal.aborted ||
			(error instanceof Error && error.name === "AbortError")
		) {
			throw new CloudflareAccessEmailListApiError(
				`Cloudflare Zero Trust email list ${action} timed out.`,
			);
		}

		const details =
			error instanceof Error && error.message ? error.message : "unknown error";
		throw new CloudflareAccessEmailListApiError(
			`Cloudflare Zero Trust email list ${action} request failed: ${details}.`,
		);
	}
}

function normalizeEmail(value: string | undefined): string | undefined {
	const trimmed = value?.trim().toLowerCase();
	return trimmed ? trimmed : undefined;
}

function itemMatchesEmail(
	item: CloudflareZeroTrustListItem,
	email: string,
): boolean {
	return normalizeEmail(item.value) === email;
}

async function fetchEmailListDetails(
	apiUrl: string,
	headers: Record<string, string>,
	signal: AbortSignal,
	fetchImpl: typeof fetch,
): Promise<CloudflareZeroTrustList> {
	const { result } = await readCloudflareResponse<CloudflareZeroTrustList>(
		await fetchCloudflare(apiUrl, { headers }, "lookup", signal, fetchImpl),
		"lookup",
	);

	if (result.type !== "EMAIL") {
		throw new CloudflareAccessEmailListApiError(
			"Configured Cloudflare Zero Trust invite list must be an EMAIL list.",
		);
	}

	return result;
}

async function emailListContains(
	config: ResolvedCloudflareAccessEmailListConfig,
	headers: Record<string, string>,
	email: string,
	signal: AbortSignal,
	fetchImpl: typeof fetch,
): Promise<boolean> {
	let page = 1;

	while (true) {
		const { result, result_info: resultInfo } = await readCloudflareResponse<
			CloudflareZeroTrustListItem[]
		>(
			await fetchCloudflare(
				getCloudflareAccessEmailListItemsApiUrl(config, page),
				{ headers },
				"items lookup",
				signal,
				fetchImpl,
			),
			"items lookup",
		);

		if (result.some((item) => itemMatchesEmail(item, email))) return true;

		const currentPage = resultInfo?.page ?? page;
		const perPage = resultInfo?.per_page ?? LIST_ITEMS_PER_PAGE;
		const returned = resultInfo?.count ?? result.length;
		const total = resultInfo?.total_count ?? returned;
		if (currentPage * perPage >= total || returned === 0) {
			return false;
		}
		page = currentPage + 1;
	}
}

async function appendEmailToList(
	apiUrl: string,
	headers: Record<string, string>,
	email: string,
	signal: AbortSignal,
	fetchImpl: typeof fetch,
): Promise<void> {
	const { result } = await readCloudflareResponse<CloudflareZeroTrustList>(
		await fetchCloudflare(
			apiUrl,
			{
				method: "PATCH",
				headers,
				body: JSON.stringify({
					append: [{ value: email, description: "EmDash admin invite" }],
				}),
			},
			"append",
			signal,
			fetchImpl,
		),
		"append",
	);

	if (result.type !== undefined && result.type !== "EMAIL") {
		throw new CloudflareAccessEmailListApiError(
			"Configured Cloudflare Zero Trust invite list must be an EMAIL list.",
		);
	}
}

export async function syncCloudflareAccessEmailListEmail(
	config: CloudflareAccessEmailListConfig,
	email: string,
	fetchImpl: typeof fetch = fetch,
): Promise<CloudflareAccessEmailListSyncResult> {
	const resolvedConfig = resolveConfig(config);
	const dashboardUrl = getCloudflareAccessEmailListDashboardUrl(
		config.accountId,
	);
	if (!resolvedConfig) {
		return { status: "not_configured", dashboardUrl };
	}

	const normalizedEmail = normalizeEmail(email);
	if (!normalizedEmail) {
		throw new CloudflareAccessEmailListApiError(
			"Cannot add an empty email to Cloudflare Access.",
		);
	}

	const apiUrl = getCloudflareAccessEmailListApiUrl(resolvedConfig);
	const headers = {
		Authorization: `Bearer ${resolvedConfig.apiToken}`,
		"Content-Type": "application/json",
	};
	const controller = new AbortController();
	const timeout = setTimeout(
		() => controller.abort(),
		CLOUDFLARE_ACCESS_TIMEOUT_MS,
	);

	try {
		await fetchEmailListDetails(apiUrl, headers, controller.signal, fetchImpl);
		if (
			await emailListContains(
				resolvedConfig,
				headers,
				normalizedEmail,
				controller.signal,
				fetchImpl,
			)
		) {
			return { status: "already_present", dashboardUrl };
		}

		try {
			await appendEmailToList(
				apiUrl,
				headers,
				normalizedEmail,
				controller.signal,
				fetchImpl,
			);
		} catch (error) {
			if (
				await emailListContains(
					resolvedConfig,
					headers,
					normalizedEmail,
					controller.signal,
					fetchImpl,
				)
			) {
				return { status: "already_present", dashboardUrl };
			}
			throw error;
		}

		if (
			!(await emailListContains(
				resolvedConfig,
				headers,
				normalizedEmail,
				controller.signal,
				fetchImpl,
			))
		) {
			throw new CloudflareAccessEmailListApiError(
				"Cloudflare Zero Trust email list append did not persist the invited email.",
			);
		}

		return { status: "added", dashboardUrl };
	} finally {
		clearTimeout(timeout);
	}
}
