import assert from 'node:assert/strict';

import type { ApiResponse, Session } from './client.ts';

export const NOSQL_OPERATORS: object[] = [{ $ne: null }, { $gt: '' }, { $regex: '.*' }, { $where: '1' }];

/** The same user id with a token that was never issued. */
export const forgedToken = (session: Session) => ({ userId: session.userId, authToken: `${session.authToken}forged` });

/** One user's token presented with another user's id. */
export const swappedIdentity = (owner: Session, other: Session) => ({ userId: owner.userId, authToken: other.authToken });

export function assertRejected(response: ApiResponse, allowed: number[] = [400, 401, 403, 404]): void {
	assert.ok(allowed.includes(response.status), `expected one of ${allowed.join(', ')} but got ${response.status}: ${response.text.slice(0, 200)}`);
	assert.notEqual(response.body?.success, true, 'the call must not report success');
}

export function assertNoServerError(response: ApiResponse): void {
	assert.ok(response.status < 500, `a 5xx leaks that the input reached unhandled code: got ${response.status}: ${response.text.slice(0, 200)}`);
}

/** Error bodies must not carry stack traces or file paths. */
export function assertNoInternalsLeaked(response: ApiResponse): void {
	assert.doesNotMatch(response.text, /\bat\s+\S+\s+\(.*:\d+:\d+\)/, 'a stack trace was returned');
	assert.doesNotMatch(response.text, /(node_modules|\/app\/bundle|\/home\/\w+)/, 'a file path was returned');
	if (typeof response.body === 'object' && response.body) {
		assert.ok(!('stack' in response.body), 'the body exposes a stack property');
	}
}
