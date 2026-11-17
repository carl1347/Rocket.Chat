import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { TestUser } from '../lib/client.ts';
import { Fixture, get, post, texts } from '../lib/client.ts';

describe('Direct messages API regression', () => {
	let fx: Fixture;
	let alice: TestUser;
	let bob: TestUser;
	let rid: string;

	before(async () => {
		fx = await Fixture.create();
		alice = await fx.user('dm-a');
		bob = await fx.user('dm-b');
		rid = (await post('im.create', { session: alice, body: { username: bob.username } })).body.room.rid;
	});

	after(() => fx.dispose());

	it('im.create returns the room contract', async () => {
		const { status, body } = await post('im.create', { session: alice, body: { username: bob.username } });

		assert.equal(status, 200);
		assert.equal(body.success, true);
		assert.equal(body.room.t, 'd');
		assert.equal(body.room._id, body.room.rid);
		assert.deepEqual([...body.room.usernames].sort(), [alice.username, bob.username].sort());
	});

	it('creating the same pair again returns the same room and does not duplicate it', async () => {
		const again = await post('im.create', { session: alice, body: { username: bob.username } });
		const list = await get('im.list', { session: alice });
		const withBob = list.body.ims.filter((room: { usernames: string[] }) => room.usernames.includes(bob.username));

		assert.equal(again.body.room.rid, rid);
		assert.equal(withBob.length, 1);
	});

	it('the pair resolves to the same room whoever starts it', async () => {
		const fromBob = await post('im.create', { session: bob, body: { username: alice.username } });

		assert.equal(fromBob.body.room.rid, rid);
	});

	it('a message sent to the room shows up in im.messages for both users', async () => {
		await fx.message(alice, rid, 'hello bob');

		for (const user of [alice, bob]) {
			const { status, body } = await get('im.messages', { session: user, query: { roomId: rid } });
			assert.equal(status, 200);
			assert.ok(texts(body.messages).includes('hello bob'));
		}
	});

	it('im.members lists both users', async () => {
		const { status, body } = await get('im.members', { session: alice, query: { roomId: rid } });

		assert.equal(status, 200);
		assert.deepEqual(body.members.map((member: { username: string }) => member.username).sort(), [alice.username, bob.username].sort());
	});

	it('im.counters reports the conversation', async () => {
		const { status, body } = await get('im.counters', { session: alice, query: { roomId: rid } });

		assert.equal(status, 200);
		assert.equal(body.joined, true);
	});

	it('closing and reopening a direct message succeeds', async () => {
		const close = await post('im.close', { session: alice, body: { roomId: rid } });
		const open = await post('im.open', { session: alice, body: { roomId: rid } });

		assert.equal(close.status, 200);
		assert.equal(open.status, 200);
	});

	it('a user can open a direct message with themselves', async () => {
		const { status, body } = await post('im.create', { session: alice, body: { username: alice.username } });

		assert.equal(status, 200);
		assert.equal(body.room.t, 'd');
	});

	it('rejects an unknown username with 400 error-invalid-user', async () => {
		const { status, body } = await post('im.create', { session: alice, body: { username: 'reg-user-that-does-not-exist' } });

		assert.equal(status, 400);
		assert.equal(body.errorType, 'error-invalid-user');
	});

	it('rejects a request with no username with 400', async () => {
		const { status } = await post('im.create', { session: alice, body: {} });

		assert.equal(status, 400);
	});

	it('rejects a direct message above DirectMesssage_maxUsers', async () => {
		const carol = await fx.user('dm-c');
		await fx.setting('DirectMesssage_maxUsers', 2);

		const { status, body } = await post('im.create', { session: alice, body: { usernames: `${bob.username},${carol.username}` } });

		assert.equal(status, 400);
		assert.equal(body.errorType, 'error-direct-message-max-user-exceeded');
	});
});
