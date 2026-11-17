const url = (process.env.OLLAMA_URL ?? 'http://localhost:11434').replace(/\/$/, '');
const model = process.env.OLLAMA_MODEL ?? 'qwen2.5:7b-instruct';

try {
	const response = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(5000) });
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}`);
	}
	const { models = [] } = await response.json();
	const names = models.map((entry) => entry.name);
	if (!names.some((name) => name === model || name === `${model}:latest`)) {
		console.error(`Ollama is running at ${url} but the model "${model}" is not installed.\nInstalled: ${names.join(', ') || '(none)'}\nRun: ollama pull ${model}`);
		process.exit(1);
	}
	console.log(`Ollama OK at ${url} with model ${model}`);
} catch (error) {
	console.error(`Cannot reach Ollama at ${url} (${error.message}).\nStart it with: ollama serve`);
	process.exit(1);
}
