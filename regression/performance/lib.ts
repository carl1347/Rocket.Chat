import { mkdirSync, writeFileSync } from 'node:fs';

import autocannon from 'autocannon';

import type { Session } from '../lib/client.ts';
import { Fixture, authHeaders, config } from '../lib/client.ts';

export type Scenario = {
	name: string;
	method: 'GET' | 'POST';
	path: string;
	session?: Pick<Session, 'userId' | 'authToken'>;
	body?: unknown;
	/** Status every response must have. Defaults to any 2xx. */
	expectedStatus?: number;
};

export const limits = {
	durationSeconds: Number(process.env.PERF_DURATION ?? 10),
	connections: Number(process.env.PERF_CONNECTIONS ?? 10),
	maxP99Ms: Number(process.env.PERF_P99_MS ?? 1500),
	minRequestsPerSecond: Number(process.env.PERF_MIN_RPS ?? 5),
};

type Outcome = {
	name: string;
	requests: number;
	requestsPerSecond: number;
	p50Ms: number;
	p99Ms: number;
	unexpected: number;
	failures: string[];
};

async function measure(scenario: Scenario): Promise<Outcome> {
	const result = await autocannon({
		url: new URL(scenario.path.startsWith('/') ? scenario.path : `/api/v1/${scenario.path}`, config.baseUrl).toString(),
		method: scenario.method,
		headers: {
			...(scenario.session ? authHeaders(scenario.session) : {}),
			...(scenario.body === undefined ? {} : { 'Content-Type': 'application/json' }),
		},
		body: scenario.body === undefined ? undefined : JSON.stringify(scenario.body),
		connections: limits.connections,
		duration: limits.durationSeconds,
		timeout: 15,
	});

	const total = result.requests.total;
	const expected = scenario.expectedStatus === undefined ? result['2xx'] : (result.statusCodeStats?.[`${scenario.expectedStatus}` as `${number}`]?.count ?? 0);
	const unexpected = total - expected + result.errors + result.timeouts;

	const failures: string[] = [];
	if (unexpected > 0) {
		failures.push(`${unexpected} responses were not ${scenario.expectedStatus ?? '2xx'}, failed or timed out`);
	}
	if (result.latency.p99 > limits.maxP99Ms) {
		failures.push(`p99 ${result.latency.p99} ms is above ${limits.maxP99Ms} ms`);
	}
	if (result.requests.average < limits.minRequestsPerSecond) {
		failures.push(`${result.requests.average} req/s is below ${limits.minRequestsPerSecond} req/s`);
	}

	return {
		name: scenario.name,
		requests: total,
		requestsPerSecond: result.requests.average,
		p50Ms: result.latency.p50,
		p99Ms: result.latency.p99,
		unexpected,
		failures,
	};
}

/** Builds the scenarios of one feature, measures each, writes the JSON report and sets the exit code. */
export async function runFeature(feature: string, build: (fx: Fixture) => Promise<Scenario[]>): Promise<void> {
	const fx = await Fixture.create();
	const outcomes: Outcome[] = [];
	try {
		for (const scenario of await build(fx)) {
			console.log(`  running ${scenario.name} for ${limits.durationSeconds}s with ${limits.connections} connections`);
			outcomes.push(await measure(scenario));
		}
	} finally {
		await fx.dispose();
	}

	mkdirSync('reports/performance', { recursive: true });
	writeFileSync(`reports/performance/${feature}.json`, JSON.stringify({ feature, limits, outcomes }, null, 2));

	console.table(outcomes.map(({ failures, ...row }) => ({ ...row, result: failures.length ? 'FAIL' : 'PASS' })));
	for (const outcome of outcomes) {
		outcome.failures.forEach((failure) => console.error(`  FAIL ${outcome.name}: ${failure}`));
	}
	process.exitCode = outcomes.some((outcome) => outcome.failures.length) ? 1 : 0;
}
