import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { build } from "esbuild";

export async function importBundled(
	entryPoint: string,
	virtualModules: Record<string, string> = {},
	externalPackages = false,
): Promise<Record<string, unknown>> {
	const result = await build({
		bundle: true,
		entryPoints: [resolve(entryPoint)],
		format: externalPackages ? "cjs" : "esm",
		packages: externalPackages ? "external" : undefined,
		platform: "node",
		plugins: [
			{
				name: "test-modules",
				setup(build) {
					build.onResolve({ filter: /.*/ }, ({ path }) => {
						if (Object.hasOwn(virtualModules, path)) {
							return { namespace: "test-module", path };
						}
					});
					build.onLoad(
						{ filter: /.*/, namespace: "test-module" },
						({ path }) => ({ contents: virtualModules[path], loader: "js" }),
					);
				},
			},
		],
		write: false,
	});
	const source = result.outputFiles[0].contents;

	if (externalPackages) {
		const checkModule = { exports: {} };
		new Function(
			"require",
			"module",
			"exports",
			Buffer.from(source).toString(),
		)(createRequire(import.meta.url), checkModule, checkModule.exports);
		return checkModule.exports;
	}
	return import(
		`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
	);
}
