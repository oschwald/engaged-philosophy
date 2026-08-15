import { spawnSync } from "node:child_process";

import { describe, expect, test } from "vitest";

function expectMalformedImageToTerminate(
	moduleName: "heif" | "icns" | "jxl",
	setup: string,
) {
	const result = spawnSync(
		process.execPath,
		[
			"--input-type=module",
			"--eval",
			`
				import { createRequire } from "node:module";
				import { pathToFileURL } from "node:url";

				const require = createRequire(import.meta.url);
				const emdashRequire = createRequire(require.resolve("emdash"));
				const moduleUrl = pathToFileURL(
					emdashRequire.resolve("image-size/types/${moduleName}"),
				);
				const parser = (await import(moduleUrl.href)).${moduleName.toUpperCase()};
				${setup}
				try {
					parser.calculate(input);
				} catch {}
			`,
		],
		{
			cwd: process.cwd(),
			encoding: "utf8",
			timeout: 2_000,
		},
	);

	expect(result.error, result.stderr).toBeUndefined();
	expect(result.status, result.stderr).toBe(0);
}

describe("patched image-size parsers", () => {
	test("rejects a zero-length ICNS entry without blocking the event loop", () => {
		expectMalformedImageToTerminate(
			"icns",
			`
				const input = new Uint8Array(16);
				const view = new DataView(input.buffer);
				input.set(new TextEncoder().encode("icns"), 0);
				view.setUint32(4, 16);
				input.set(new TextEncoder().encode("ic10"), 8);
				view.setUint32(12, 0);
			`,
		);
	});

	test("rejects a zero-length JXL box without blocking the event loop", () => {
		expectMalformedImageToTerminate(
			"jxl",
			`
				const input = new Uint8Array(24);
				new DataView(input.buffer).setUint32(0, 0);
				input.set(new TextEncoder().encode("jxlp"), 4);
			`,
		);
	});

	test("rejects a zero-length HEIF box without blocking the event loop", () => {
		expectMalformedImageToTerminate(
			"heif",
			`
				const input = new Uint8Array(48);
				const view = new DataView(input.buffer);
				const encoder = new TextEncoder();
				const writeBox = (offset, size, name) => {
					view.setUint32(offset, size);
					input.set(encoder.encode(name), offset + 4);
				};
				writeBox(0, 48, "meta");
				writeBox(12, 36, "iprp");
				writeBox(20, 28, "ipco");
				writeBox(28, 0, "ispe");
			`,
		);
	});
});
