export interface BatchableNote {
	estimatedTokens: number;
}

export function estimateTokens(markdown: string): number {
	const words = markdown.trim().split(/\s+/).filter(Boolean).length;
	return Math.ceil(words / 0.75);
}

export function groupByTokenBudget<T extends BatchableNote>(
	notes: T[],
	maxTokens: number,
): T[][] {
	if (!Number.isSafeInteger(maxTokens) || maxTokens < 1) {
		throw new Error("Batch token budget must be a positive whole number.");
	}

	const batches: T[][] = [];
	let batch: T[] = [];
	let batchTokens = 0;

	for (const note of notes) {
		if (batch.length > 0 && batchTokens + note.estimatedTokens > maxTokens) {
			batches.push(batch);
			batch = [];
			batchTokens = 0;
		}

		if (note.estimatedTokens > maxTokens) {
			batches.push([note]);
			continue;
		}

		batch.push(note);
		batchTokens += note.estimatedTokens;
	}

	if (batch.length > 0) {
		batches.push(batch);
	}

	return batches;
}
