import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { TestUser } from '../lib/client.ts';
import { Fixture, get, post } from '../lib/client.ts';
import { NOSQL_OPERATORS, assertNoInternalsLeaked, assertNoServerError, assertRejected, forgedToken } from '../lib/security.ts';

describe('Direct messages security regression', () => {
	let fx: Fixture;
	let alice: TestUser;
	let bob: TestUser;
	let mallory: TestUser;
	let rid: string;

	before(async () => {
		fx = await Fixture.create();
		alice = await fx.user('dm-a');
		bob = await fx.user('dm-b');
		mallory = await fx.user('dm-m');
		rid = (await post('im.create', { session: alice, body: { username: bob.username } })).body.room.rid;
		await fx.message(alice, rid, 'private to alice and bob');
	});

	after(() => fx.dispose());

	describe('authentication', () => {
		it('rejects unauthenticated calls', async () => {
			assert.equal((await post('im.create', { body: { username: bob.username } })).status, 401);
			assert.equal((await get('im.list')).status, 401);
		});

		it('rejects a forged token', async () => {
			assert.equal((await post('im.create', { session: forgedToken(alice), body: { username: bob.username } })).status, 401);
		});
	});

	describe('a third user cannot reach a conversation they are not part of', () => {
		it('cannot read its messages', async () => {
			const response = await get('im.messages', { session: mallory, query: { roomId: rid } });

			assertRejected(response);
			assert.ok(!response.text.includes('private to alice and bob'));
		});

		it('cannot list its members or counters', async () => {
			assertRejected(await get('im.members', { session: mallory, query: { roomId: rid } }));
			const counters = await get('im.counters', { session: mallory, query: { roomId: rid } });
			assert.ok(!(counters.status === 200 && counters.body.joined === true), 'a stranger must not be reported as joined');
		});

		it('cannot post into it', async () => {
			assertRejected(await post('chat.sendMessage', { session: mallory, body: { message: { rid, msg: 'intruder' } } }));

			const { body } = await get('im.messages', { session: alice, query: { roomId: rid } });
			assert.ok(!body.messages.some((m: { msg: string }) => m.msg === 'intruder'));
		});

		it('does not see it in their own list', async () => {
			const { body } = await get('im.list', { session: mallory });

			assert.ok(!body.ims.some((room: { _id: string }) => room._id === rid));
		});
	});

	describe('creating direct messages for other people', () => {
		it('a standard user cannot create a conversation that excludes themselves', async () => {
			const response = await post('im.create', { session: alice, body: { usernames: `${bob.username},${mallory.username}`, excludeSelf: true } });

			assertRejected(response, [400, 401, 403]);
		});
	});

	describe('input handling', () => {
		it('rejects operator-style usernames without a server error', async () => {
			for (const operator of NOSQL_OPERATORS) {
				const response = await post('im.create', { session: alice, body: { username: operator } });

				assertNoServerError(response);
				assertRejected(response);
			}
		});

		it('rejects hostile usernames without a server error', async () => {
			for (const username of ['../../etc/passwd', '<script>alert(1)</script>', "' OR '1'='1", 'a'.repeat(5000), '\u0000']) {
				const response = await post('im.create', { session: alice, body: { username } });

				assertNoServerError(response);
				assertRejected(response);
			}
		});

		it('errors do not carry stack traces or file paths', async () => {
			const response = await post('im.create', { session: alice, body: { username: 'dm-user-that-does-not-exist' } });

			assertRejected(response);
			assertNoInternalsLeaked(response);
		});
	});
});
