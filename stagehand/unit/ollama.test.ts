import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

import { StagehandClientCreateConfigSchema } from '@browserbasehq/stagehand';

import { ollamaClientLLM } from '../src/ollama.ts';

type Seen = { url?: string; body?: any };

describe('ollamaClientLLM adapter (no Ollama needed)', () => {
	const seen: Seen = {};
	let reply: object = {};
	let status = 200;
	let baseUrl = '';
	const server = createServer((request, response) => {
		let raw = '';
		request.on('data', (chunk) => (raw += chunk));
		request.on('end', () => {
			seen.url = request.url;
			seen.body = JSON.parse(raw);
			response.writeHead(status, { 'content-type': 'application/json' });
			response.end(JSON.stringify(reply));
		});
	});

	before(async () => {
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	});

	after(() => server.close());

	const llm = () => ollamaClientLLM({ baseUrl, model: 'test-model', numCtx: 4096 });

	it('is accepted as the model of a Stagehand instance', () => {
		const parsed = StagehandClientCreateConfigSchema.safeParse({ model: llm() });

		assert.equal(parsed.success, true);
	});

	it('sends the system prompt, history and options to /api/chat and returns text', async () => {
		status = 200;
		reply = { message: { content: 'hola' }, done_reason: 'stop', prompt_eval_count: 11, eval_count: 3 };

		const result = await llm().generate({
			systemPrompt: 'be brief',
			temperature: 0.2,
			stopSequences: ['END'],
			messages: [{ role: 'user', content: { type: 'text', text: 'say hi' } }],
		});

		assert.equal(seen.url, '/api/chat');
		assert.deepEqual(seen.body.messages, [
			{ role: 'system', content: 'be brief' },
			{ role: 'user', content: 'say hi' },
		]);
		assert.equal(seen.body.model, 'test-model');
		assert.equal(seen.body.stream, false);
		assert.deepEqual(seen.body.options, { temperature: 0.2, num_ctx: 4096, stop: ['END'] });
		assert.equal(seen.body.format, undefined);
		assert.equal(result.outputFormat, 'text');
		assert.deepEqual(result.content, { type: 'text', text: 'hola' });
		assert.deepEqual(result.usage, { inputTokens: 11, outputTokens: 3, totalTokens: 14 });
	});

	it('constrains a structured request with the JSON schema and parses the answer', async () => {
		const schema = { type: 'object', properties: { answer: { type: 'boolean' } }, required: ['answer'] };
		reply = { message: { content: '{"answer":true}' } };

		const result = await llm().generate({
			messages: [{ role: 'user', content: [{ type: 'text', text: 'is it?' }] }],
			responseFormat: { type: 'json_schema', name: 'Answer', schema },
		});

		assert.deepEqual(seen.body.format, schema);
		assert.equal(result.outputFormat, 'json_schema');
		assert.deepEqual('structuredContent' in result && result.structuredContent, { answer: true });
	});

	it('passes images to the model as base64', async () => {
		reply = { message: { content: 'ok' } };

		await llm().generate({ messages: [{ role: 'user', content: [{ type: 'text', text: 'see' }, { type: 'image', data: 'QUJD', mimeType: 'image/png' }] }] });

		assert.deepEqual(seen.body.messages[0], { role: 'user', content: 'see', images: ['QUJD'] });
	});

	it('reports an Ollama failure with the status and model', async () => {
		status = 404;
		reply = { error: 'model not found' };

		await assert.rejects(() => llm().generate({ messages: [{ role: 'user', content: { type: 'text', text: 'x' } }] }), /HTTP 404.*test-model/);
	});
});
