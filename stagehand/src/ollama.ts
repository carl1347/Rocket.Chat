import type { ClientLLM } from '@browserbasehq/stagehand';

type GenerateParams = Parameters<ClientLLM['generate']>[0];
type MessageContent = GenerateParams['messages'][number]['content'];

export type OllamaOptions = { baseUrl: string; model: string; numCtx?: number; timeoutMs?: number };

/** Flattens Stagehand content blocks into what Ollama's chat API takes: text plus base64 images. */
const flatten = (content: MessageContent): { text: string; images: string[] } => {
	const texts: string[] = [];
	const images: string[] = [];
	for (const block of Array.isArray(content) ? content : [content]) {
		if (block.type === 'text') {
			texts.push(block.text);
		} else if (block.type === 'image') {
			images.push(block.data);
		} else if (block.type === 'tool_use') {
			texts.push(JSON.stringify({ tool: block.name, input: block.input }));
		} else {
			texts.push(block.content.map((part) => (part.type === 'text' ? part.text : '[image]')).join('\n'));
		}
	}
	return { text: texts.join('\n'), images };
};

/**
 * A Stagehand model that runs on a local Ollama server. Structured requests use Ollama's `format` so the
 * model is constrained to the JSON schema Stagehand asks for. Tool calling is not supported.
 */
export function ollamaClientLLM({ baseUrl, model, numCtx = 16384, timeoutMs = 240_000 }: OllamaOptions): ClientLLM {
	return {
		async generate(params) {
			const structured = params.responseFormat?.type === 'json_schema' ? params.responseFormat : undefined;
			const messages = [
				...(params.systemPrompt ? [{ role: 'system', content: params.systemPrompt }] : []),
				...params.messages.map((message) => {
					const { text, images } = flatten(message.content);
					return { role: message.role, content: text, ...(images.length ? { images } : {}) };
				}),
			];

			const response = await fetch(`${baseUrl}/api/chat`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				signal: AbortSignal.timeout(timeoutMs),
				body: JSON.stringify({
					model,
					messages,
					stream: false,
					...(structured ? { format: structured.schema } : {}),
					options: { temperature: params.temperature ?? 0, num_ctx: numCtx, ...(params.stopSequences ? { stop: params.stopSequences } : {}) },
				}),
			});
			if (!response.ok) {
				throw new Error(`Ollama answered HTTP ${response.status} for model ${model}: ${(await response.text()).slice(0, 300)}`);
			}

			const body = (await response.json()) as {
				message?: { content?: string };
				done_reason?: string;
				prompt_eval_count?: number;
				eval_count?: number;
			};
			const text = body.message?.content ?? '';
			const inputTokens = body.prompt_eval_count ?? 0;
			const outputTokens = body.eval_count ?? 0;
			const base = {
				role: 'assistant' as const,
				content: { type: 'text' as const, text },
				...(body.done_reason ? { stopReason: body.done_reason } : {}),
				usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
			};

			if (structured) {
				return { ...base, outputFormat: 'json_schema' as const, structuredContent: JSON.parse(text) };
			}
			return { ...base, outputFormat: 'text' as const };
		},
	};
}
