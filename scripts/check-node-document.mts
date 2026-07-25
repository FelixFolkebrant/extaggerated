import assert from "node:assert/strict";
import { parseNodeDocument, renderNodeDocument } from "../src/nodeDocument.ts";

const document = parseNodeDocument(
	{
		overview: "A compact map of practical account security notes.",
		sources: [
			{ context: "Explains the tradeoffs of password managers.", id: "2" },
			{ context: "Covers hardware-backed multi-factor authentication.", id: "1" },
		],
	},
	new Set(["1", "2"]),
);

assert.equal(
	renderNodeDocument("Account security", {
		...document,
		sources: [
			{ ...document.sources[0], link: "[[Password managers]]" },
			{ ...document.sources[1], link: "[[Multi-factor authentication]]" },
		],
	}),
	`# Account security

A compact map of practical account security notes.

## Sources

### [[Password managers]]

Explains the tradeoffs of password managers.

### [[Multi-factor authentication]]

Covers hardware-backed multi-factor authentication.
`,
);

assert.throws(
	() =>
		parseNodeDocument(
			{ overview: "Overview", sources: [{ context: "Context", id: "missing" }] },
			new Set(["1"]),
		),
	/invalid source/,
);
assert.throws(
	() =>
		parseNodeDocument(
			{
				overview: "See [[Unrelated note]] for more.",
				sources: [{ context: "Context", id: "1" }],
			},
			new Set(["1"]),
		),
	/invalid node document/,
);
assert.throws(
	() =>
		parseNodeDocument(
			{
				overview: "Overview",
				sources: [
					{ context: "First context", id: "1" },
					{ context: "Second context", id: "1" },
				],
			},
			new Set(["1"]),
		),
	/invalid source/,
);
