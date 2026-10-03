import {
	measureMissingPaths,
	measureRepresentativePaths,
} from "../e2e/support/cache-usage.ts";
import {
	completeSetup,
	jsonRequest,
	startWorkerServer,
} from "../e2e/support/worker-server.ts";

// A separate local state directory keeps this measurement out of e2e workers.
const server = await startWorkerServer(9000);
try {
	await completeSetup(server.baseURL);
	const post = async (path, data) =>
		jsonRequest(server.baseURL, path, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
		});
	const paragraph = (text) => [
		{
			_type: "block",
			_key: "text",
			style: "normal",
			markDefs: [],
			children: [{ _type: "span", _key: "span", text, marks: [] }],
		},
	];
	await post("/_emdash/api/taxonomies/topic/terms", {
		slug: "measurement-topic",
		label: "Measurement Topic",
	});
	const publish = async (collection, data) => {
		const result = await post(`/_emdash/api/content/${collection}`, data);
		return post(
			`/_emdash/api/content/${collection}/${result.data.item.id}/publish`,
			{},
		);
	};
	await publish("pages", {
		slug: "measurement-page",
		data: {
			title: "Measurement page",
			content: paragraph("Measurement content with sidebar"),
		},
	});
	await publish("projects", {
		slug: "measurement-project",
		taxonomies: { topic: ["measurement-topic"] },
		data: {
			title: "Measurement project",
			content: paragraph("Measurement project topics"),
		},
	});
	await publish("posts", {
		slug: "measurement-post",
		publishedAt: "2026-07-26T12:00:00Z",
		data: {
			title: "Measurement post",
			content: paragraph("Measurement search content"),
		},
	});
	const representative = await measureRepresentativePaths(server, [
		{ name: "home", path: "/" },
		{ name: "content-sidebar", path: "/measurement-page/" },
		{ name: "project-topics", path: "/project/measurement-project/" },
		{ name: "taxonomy-archive", path: "/topic/measurement-topic/" },
		{ name: "search", path: "/?s=Measurement" },
	]);
	const { addedKeys, ...measurement } = await measureMissingPaths(server);
	server.assertNoErrors();
	console.log(
		JSON.stringify(
			{
				representative,
				missingPaths: { ...measurement, addedCacheKeys: addedKeys.length },
				limits:
					"Local TTFB/full-response wall time and SQL query count only. KV key delta excludes writes to existing keys. Worker CPU, D1 rows, KV read/write operations and production edge cache hits are not measured.",
			},
			null,
			2,
		),
	);
} finally {
	await server.stop();
}
