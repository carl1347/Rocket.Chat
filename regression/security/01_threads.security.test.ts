import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { Room, Session, TestUser } from '../lib/client.ts';
import { Fixture, get, post, roomTexts } from '../lib/client.ts';
import { NOSQL_OPERATORS, assertNoInternalsLeaked, assertNoServerError, assertRejected, forgedToken, swappedIdentity } from '../lib/security.ts';

describe('Threads security regression', () => {
	let fx: Fixture;
	let alice: TestUser;
	let mallory: TestUser;
	let publicRoom: Room;
	let privateRoom: Room;
	let privateParent: { _id: string };

	before(async () => {
		fx = await Fixture.create();
		alice = await fx.user('thr-a');
		mallory = await fx.user('thr-m');
		publicRoom = await fx.channel(fx.admin, [alice.username, mallory.username]);
		privateRoom = await fx.group(fx.admin, [alice.username]);
		privateParent = await fx.message(fx.admin, privateRoom._id, 'private parent');
	});

	after(() => fx.dispose());

	const reply = (session: Pick<Session, 'userId' | 'authToken'>, rid: string, tmid: unknown, msg = 'probe') =>
		post('chat.sendMessage', { session, body: { message: { rid, msg, tmid } } });

	describe('authentication', () => {
		it('rejects a request with no credentials', async () => {
			assert.equal((await post('chat.sendMessage', { body: { message: { rid: publicRoom._id, msg: 'x' } } })).status, 401);
			assert.equal((await get('chat.getThreadMessages', { query: { tmid: privateParent._id } })).status, 401);
		});

		it('rejects a forged token', async () => {
			assert.equal((await reply(forgedToken(alice), publicRoom._id, undefined)).status, 401);
		});

		it("rejects one user's token presented with another user's id", async () => {
			assert.equal((await reply(swappedIdentity(alice, mallory), publicRoom._id, undefined)).status, 401);
		});
	});

	describe('authorization', () => {
		it('does not let a non-member read the thread of a private room', async () => {
			const response = await get('chat.getThreadMessages', { session: mallory, query: { tmid: privateParent._id } });

			assertRejected(response);
		});

		it('does not let a non-member post into a private room', async () => {
			assertRejected(await reply(mallory, privateRoom._id, privateParent._id));
		});

		it('does not let a public rid plus a private tmid smuggle a message into the private room', async () => {
			const response = await reply(mallory, publicRoom._id, privateParent._id, 'smuggled');

			assertRejected(response);
			assert.ok(!(await roomTexts(fx.admin, privateRoom._id)).includes('smuggled'));
		});
	});

	describe('input handling', () => {
		it('rejects query operators in tmid without a server error', async () => {
			for (const operator of NOSQL_OPERATORS) {
				const response = await reply(alice, publicRoom._id, operator);
				assertNoServerError(response);
				assertRejected(response);
			}
		});

		it('rejects an operator-style tmid in the thread listing without a server error', async () => {
			const response = await get('chat.getThreadMessages', { session: alice, query: { 'tmid[$ne]': 'x' } });

			assertNoServerError(response);
			assert.notEqual(response.status, 200);
		});

		it('rejects an oversized message without a server error', async () => {
			const response = await reply(alice, publicRoom._id, undefined, 'a'.repeat(200_000));

			assertNoServerError(response);
			assertRejected(response);
		});

		it('keeps markup in a message inert and does not fail', async () => {
			const payload = '<img src=x onerror=alert(1)><script>alert(1)</script>';

			const response = await reply(alice, publicRoom._id, undefined, payload);

			assertNoServerError(response);
			assert.equal(response.body.message?.msg, payload, 'the server stores text and leaves escaping to the clients');
		});
	});

	describe('information exposure', () => {
		it('errors do not carry stack traces or file paths', async () => {
			const response = await reply(alice, publicRoom._id, 12345);

			assertRejected(response);
			assertNoInternalsLeaked(response);
		});
	});
});
