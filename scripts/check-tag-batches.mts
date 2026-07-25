import assert from "node:assert/strict";
import { estimateTokens, groupByTokenBudget } from "../src/tagBatching.ts";

const notes = [
	{ estimatedTokens: estimateTokens("one two three"), path: "fits-a.md" },
	{ estimatedTokens: estimateTokens("one two three four"), path: "fits-b.md" },
	{ estimatedTokens: estimateTokens("one two three four five six seven eight"), path: "oversized.md" },
	{ estimatedTokens: estimateTokens("one"), path: "after-oversized.md" },
];

assert.deepEqual(
	groupByTokenBudget(notes, 10).map((batch) => batch.map((note) => note.path)),
	[["fits-a.md", "fits-b.md"], ["oversized.md"], ["after-oversized.md"]],
);
