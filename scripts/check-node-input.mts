import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
	bundle: true,
	entryPoints: ["src/nodeGeneration.ts"],
	format: "esm",
	platform: "node",
	plugins: [
		{
			name: "obsidian-stub",
			setup(build) {
				build.onResolve({ filter: /^obsidian$/ }, () => ({
					namespace: "obsidian-stub",
					path: "obsidian",
				}));
				build.onLoad({ filter: /.*/, namespace: "obsidian-stub" }, () => ({
					contents:
						'export class TFolder {}; export function requestUrl() { throw new Error("provider called"); }',
				}));
			},
		},
	],
	write: false,
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(
	bundle.outputFiles[0].text,
).toString("base64")}`;
const { generateNode, nodeFolder, nodeName } = (await import(
	moduleUrl
)) as typeof import("../src/nodeGeneration.ts");

// These portable-invalid values previously passed and failed only after an
// expensive provider request or on a different device's filesystem.
assert.throws(() => nodeName("Roadmap\u0007notes"), /file name/);
assert.throws(() => nodeName("Roadmap."), /file name/);
assert.throws(() => nodeFolder("XT:Nodes"), /vault-relative nodes folder/);
assert.throws(
	() => nodeFolder("XT/Archive. /Notes"),
	/vault-relative nodes folder/,
);
assert.throws(
	() => nodeFolder("XT/Archive /Notes"),
	/vault-relative nodes folder/,
);

for (const reserved of [
	"CON",
	"prn.md",
	"AUX",
	"nul.txt",
	"COM1",
	"com9.md",
	"LPT1",
	"lpt9.txt",
]) {
	assert.throws(() => nodeName(reserved), /file name/);
	assert.throws(
		() => nodeFolder(`XT/${reserved}`),
		/vault-relative nodes folder/,
	);
}

assert.equal(nodeName("COM10"), "COM10");
assert.equal(nodeFolder("XT/console"), "XT/console");

async function rejectsBeforeVault(
	name: string,
	nodesFolder: string,
	message: RegExp,
): Promise<void> {
	let appReads = 0;
	const plugin = {
		get app() {
			appReads += 1;
			throw new Error("vault touched");
		},
		settings: {
			model: "model",
			nodesFolder,
			openRouterApiKey: "key",
		},
	};

	await assert.rejects(
		generateNode(plugin as never, {
			description: "A useful collection.",
			name,
		}),
		message,
	);
	assert.equal(appReads, 0);
}

// These catch generateNode bypassing or moving validation after vault work.
await rejectsBeforeVault("Roadmap\u0007notes", "XT/Nodes", /file name/);
await rejectsBeforeVault("Roadmap.", "XT/Nodes", /file name/);
await rejectsBeforeVault("con.md", "XT/Nodes", /file name/);
await rejectsBeforeVault(
	"Valid name",
	"XT:Nodes",
	/vault-relative nodes folder/,
);
await rejectsBeforeVault(
	"Valid name",
	"XT/Archive. /Nodes",
	/vault-relative nodes folder/,
);
await rejectsBeforeVault(
	"Valid name",
	"XT/Archive /Nodes",
	/vault-relative nodes folder/,
);
await rejectsBeforeVault(
	"Valid name",
	"XT/LPT9.txt",
	/vault-relative nodes folder/,
);
