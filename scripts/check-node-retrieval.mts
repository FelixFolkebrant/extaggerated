import assert from "node:assert/strict";
import { findNodeCandidates } from "../src/nodeRetrieval.ts";

const files = [
	{ path: "notes/fresh.md" },
	{ path: "notes/manual.md" },
	{ path: "notes/ignored.md" },
	{ path: "notes/cybersecurity.md" },
	{ path: "XT Nodes/existing.md" },
	{ path: "XT Nodes Archive/keep.md" },
];
const frontmatter = new Map([
	["notes/fresh.md", { tags: ["#security", "credential"] }],
	["notes/manual.md", { tags: "#security, password-manager" }],
	["notes/ignored.md", { tags: ["security"], xt_ignore: true }],
	["notes/cybersecurity.md", { tags: ["cybersecurity"] }],
	["XT Nodes/existing.md", { tags: ["security"] }],
	["XT Nodes Archive/keep.md", { tags: ["security"] }],
]);

const candidates = findNodeCandidates(
	{ getMarkdownFiles: () => files },
	{
		getFileCache: (file) => ({ frontmatter: frontmatter.get(file.path) }),
	},
	["#security", "security"],
	"XT Nodes/",
);

assert.deepEqual(
	candidates.map((file) => file.path),
	["notes/fresh.md", "notes/manual.md", "XT Nodes Archive/keep.md"],
);
