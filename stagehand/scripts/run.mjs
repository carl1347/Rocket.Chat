import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';

const FEATURES = {
	threads: '01_threads',
	rbac: '02_rbac',
	dm: '03_direct_messages',
	retention: '04_data_retention',
	webhooks: '05_webhooks',
};

const { values } = parseArgs({ options: { feature: { type: 'string', default: 'all' } } });
if (values.feature !== 'all' && !FEATURES[values.feature]) {
	console.error(`Unknown --feature "${values.feature}". Use: all, ${Object.keys(FEATURES).join(', ')}`);
	process.exit(2);
}

if (process.env.SKIP_OLLAMA_CHECK !== '1') {
	const check = spawnSync(process.execPath, ['scripts/check-ollama.mjs'], { stdio: 'inherit' });
	if (check.status !== 0) {
		process.exit(check.status ?? 1);
	}
}

mkdirSync('reports', { recursive: true });
const features = values.feature === 'all' ? Object.keys(FEATURES) : [values.feature];
const results = [];

for (const feature of features) {
	const file = `tests/${FEATURES[feature]}.e2e.ts`;
	console.log(`\n=== ${feature} (${file})`);
	const { status } = spawnSync(
		process.execPath,
		[
			'--test',
			'--test-concurrency=1',
			'--test-reporter=spec',
			'--test-reporter-destination=stdout',
			'--test-reporter=junit',
			`--test-reporter-destination=reports/stagehand-${feature}.xml`,
			file,
		],
		{ stdio: 'inherit', env: process.env },
	);
	results.push({ feature, ok: status === 0 });
}

console.log('\nStagehand summary');
results.forEach(({ feature, ok }) => console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${feature}`));
process.exit(results.every(({ ok }) => ok) ? 0 : 1);
