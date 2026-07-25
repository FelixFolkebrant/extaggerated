import { requestUrl } from "obsidian";

export interface OpenRouterJsonRequest {
	apiKey: string;
	emptyResponseMessage: string;
	incompleteJsonMessage: string;
	messages: Array<{ content: string; role: "system" | "user" }>;
	model: string;
	maxCompletionTokens?: number;
	truncatedResponseMessage: string;
}

interface OpenRouterChoice {
	finish_reason?: string;
	message?: {
		content?: string | Array<{ text?: string }>;
	};
}

interface OpenRouterResponse {
	choices?: OpenRouterChoice[];
	error?: {
		message?: string;
	};
}

export async function requestOpenRouterJson<Result>({
	apiKey,
	emptyResponseMessage,
	incompleteJsonMessage,
	messages,
	model,
	maxCompletionTokens,
	truncatedResponseMessage,
}: OpenRouterJsonRequest): Promise<Result> {
	const response = await requestUrl({
		body: JSON.stringify({
			...(maxCompletionTokens === undefined
				? {}
				: { max_completion_tokens: maxCompletionTokens }),
			messages,
			model,
			response_format: { type: "json_object" },
		}),
		contentType: "application/json",
		headers: {
			Authorization: `Bearer ${apiKey}`,
		},
		method: "POST",
		url: "https://openrouter.ai/api/v1/chat/completions",
	});

	const data = response.json as OpenRouterResponse;
	if (data.error?.message) {
		throw new Error(data.error.message);
	}

	const choice = data.choices?.[0];
	if (choice?.finish_reason === "length") {
		throw new Error(truncatedResponseMessage);
	}

	const content = choice?.message?.content;
	const text = Array.isArray(content)
		? content.map((part) => part.text ?? "").join("")
		: content;
	if (!text) {
		throw new Error(emptyResponseMessage);
	}

	try {
		return JSON.parse(text) as Result;
	} catch {
		throw new Error(incompleteJsonMessage);
	}
}
