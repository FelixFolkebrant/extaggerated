import { Buffer } from "node:buffer";
import { resolve } from "node:path";
import { build } from "esbuild";

export async function importBundled(
	entryPoint: string,
	virtualModules: Record<string, string> = {},
): Promise<Record<string, unknown>> {
	const result = await build({
		bundle: true,
		entryPoints: [resolve(entryPoint)],
		format: "esm",
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

	return import(
		`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`
	);
}
