import assert from "node:assert/strict";
import { importBundled } from "./bundle-test-module.mts";

const { generateNode, nodeFolder, nodeName } = (await importBundled(
	"src/nodeGeneration.ts",
	{
		obsidian:
			'export class TFolder {}; export function requestUrl() { throw new Error("provider called"); }',
	},
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
assert.throws(() => nodeName("a".repeat(253)), /file name/);
assert.throws(() => nodeName("界".repeat(85)), /file name/);
assert.throws(
	() => nodeFolder(`XT/${"a".repeat(256)}`),
	/vault-relative nodes folder/,
);

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

// One invalid name and folder prove generateNode cannot bypass or delay validation.
await rejectsBeforeVault("a".repeat(253), "XT/Nodes", /file name/);
await rejectsBeforeVault(
	"Valid name",
	`XT/${"界".repeat(86)}`,
	/vault-relative nodes folder/,
);
