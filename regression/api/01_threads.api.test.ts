import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { Room, TestUser } from '../lib/client.ts';
import { Fixture, get, post, texts } from '../lib/client.ts';

describe('Threads API regression', () => {
	let fx: Fixture;
	let alice: TestUser;
	let room: Room;
	let parent: { _id: string };

	const reply = (session: { userId: string; authToken: string }, msg: string, tmid: string) =>
		post('chat.sendMessage', { session, body: { message: { rid: room._id, msg, tmid } } });

	before(async () => {
		fx = await Fixture.create();
		alice = await fx.user('thr');
		room = await fx.channel(fx.admin, [alice.username]);
		parent = await fx.message(fx.admin, room._id, 'regression parent');
	});

	after(() => fx.dispose());

	it('chat.sendMessage with a valid tmid returns the message contract', async () => {
		const { status, body } = await reply(alice, 'reply contract', parent._id);

		assert.equal(status, 200);
		assert.equal(body.success, true);
		assert.equal(body.message.tmid, parent._id);
		assert.equal(body.message.rid, room._id);
		assert.equal(body.message.msg, 'reply contract');
		assert.equal(body.message.u.username, alice.username);
		assert.ok(body.message._id && body.message.ts);
	});

	it('every reply increases the parent tcount by exactly one and sets tlm', async () => {
		const before = (await get('chat.getMessage', { session: fx.admin, query: { msgId: parent._id } })).body.message.tcount ?? 0;

		await reply(alice, 'counted reply', parent._id);
		const after = (await get('chat.getMessage', { session: fx.admin, query: { msgId: parent._id } })).body.message;

		assert.equal(after.tcount, before + 1);
		assert.ok(after.tlm, 'the parent records the time of the last reply');
	});

	it('chat.getThreadMessages lists the replies and honors count', async () => {
		await reply(alice, 'second listed reply', parent._id);

		const all = await get('chat.getThreadMessages', { session: fx.admin, query: { tmid: parent._id } });
		assert.equal(all.status, 200);
		assert.ok(texts(all.body.messages).includes('second listed reply'));
		assert.equal(typeof all.body.total, 'number');

		const one = await get('chat.getThreadMessages', { session: fx.admin, query: { tmid: parent._id, count: 1 } });
		assert.equal(one.body.messages.length, 1);
		assert.equal(one.body.count, 1);
	});

	it('chat.getThreadsList returns the thread of the room', async () => {
		const { status, body } = await get('chat.getThreadsList', { session: fx.admin, query: { rid: room._id } });

		assert.equal(status, 200);
		assert.ok(body.threads.some((thread: { _id: string }) => thread._id === parent._id));
	});

	it('a reply to a reply is attached to the root thread, not nested', async () => {
		const first = await reply(alice, 'first level', parent._id);
		const nested = await reply(alice, 'second level', first.body.message._id);

		assert.equal(nested.status, 200);
		assert.equal(nested.body.message.tmid, parent._id);
	});

	it('a user can follow and unfollow a thread', async () => {
		const follow = await post('chat.followMessage', { session: alice, body: { mid: parent._id } });
		const unfollow = await post('chat.unfollowMessage', { session: alice, body: { mid: parent._id } });

		assert.equal(follow.status, 200);
		assert.equal(unfollow.status, 200);
	});

	it('rejects a tmid that is not a string with 400', async () => {
		const { status, body } = await post('chat.sendMessage', {
			session: fx.admin,
			body: { message: { rid: room._id, msg: 'bad tmid', tmid: 12345 } },
		});

		assert.equal(status, 400);
		assert.equal(body.success, false);
	});

	it('rejects tshow without tmid with 400', async () => {
		const { status } = await post('chat.sendMessage', { session: fx.admin, body: { message: { rid: room._id, msg: 'tshow', tshow: true } } });

		assert.equal(status, 400);
	});

	it('rejects a message without rid with 400', async () => {
		const { status } = await post('chat.sendMessage', { session: fx.admin, body: { message: { msg: 'no room' } } });

		assert.equal(status, 400);
	});

	// Pinned on purpose: the server does not look the parent up, so a tmid that points nowhere is stored.
	// When the server starts rejecting it, change this expectation to 400.
	it('currently accepts a well-formed tmid that matches no message', async () => {
		const { status } = await reply(fx.admin, 'orphan', 'does-not-exist');

		assert.equal(status, 200);
	});
});
