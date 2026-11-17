export const config = {
	baseUrl: (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
	adminUser: process.env.ADMIN_USERNAME ?? 'admin',
	adminPass: process.env.ADMIN_PASS ?? 'admin',
	ollamaUrl: (process.env.OLLAMA_URL ?? 'http://localhost:11434').replace(/\/$/, ''),
	ollamaModel: process.env.OLLAMA_MODEL ?? 'qwen2.5:7b-instruct',
	/** Stagehand sends a DOM snapshot with every call, so a small default context would truncate it. */
	ollamaNumCtx: Number(process.env.OLLAMA_NUM_CTX ?? 16384),
	headed: process.env.HEADED === '1',
	chromePath: process.env.CHROME_PATH || undefined,
	testTimeoutMs: Number(process.env.TEST_TIMEOUT_MS ?? 300_000),
};
