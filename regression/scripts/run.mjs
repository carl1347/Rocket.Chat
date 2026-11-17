import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';

const FEATURES = {
	threads: '01_threads',
	rbac: '02_rbac',
	dm: '03_direct_messages',
	retention: '04_data_retention',
	webhooks: '05_webhooks',
};
const TYPES = ['api', 'security', 'performance'];

const { values } = parseArgs({ options: { type: { type: 'string', default: 'all' }, feature: { type: 'string', default: 'all' } } });

if (values.type !== 'all' && !TYPES.includes(values.type)) {
	console.error(`Unknown --type "${values.type}". Use: all, ${TYPES.join(', ')}`);
	process.exit(2);
}
if (values.feature !== 'all' && !FEATURES[values.feature]) {
	console.error(`Unknown --feature "${values.feature}". Use: all, ${Object.keys(FEATURES).join(', ')}`);
	process.exit(2);
}

mkdirSync('reports', { recursive: true });

const types = values.type === 'all' ? TYPES : [values.type];
const features = values.feature === 'all' ? Object.keys(FEATURES) : [values.feature];
const results = [];

for (const type of types) {
	for (const feature of features) {
		const prefix = FEATURES[feature];
		const file = type === 'performance' ? `performance/${prefix}.perf.ts` : `${type}/${prefix}.${type}.test.ts`;
		if (!existsSync(file)) {
			console.error(`Missing ${file}`);
			process.exit(2);
		}
		console.log(`\n=== ${type} / ${feature} (${file})`);
		const args =
			type === 'performance'
				? [file]
				: [
						'--test',
						'--test-concurrency=1',
						'--test-reporter=spec',
						'--test-reporter-destination=stdout',
						'--test-reporter=junit',
						`--test-reporter-destination=reports/${type}-${feature}.xml`,
						file,
					];
		const { status } = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
		results.push({ type, feature, ok: status === 0 });
	}
}

console.log('\nRegression summary');
for (const { type, feature, ok } of results) {
	console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${type.padEnd(11)} ${feature}`);
}
process.exit(results.every(({ ok }) => ok) ? 0 : 1);
