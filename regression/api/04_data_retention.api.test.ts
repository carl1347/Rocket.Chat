import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { Room, TestUser } from '../lib/client.ts';
import { Fixture, post, roomTexts } from '../lib/client.ts';

const WIDE = { latest: '9999-12-31T23:59:59.000Z', oldest: '0001-01-01T00:00:00.000Z' };

describe('Data retention API regression', () => {
	let fx: Fixture;
	let alice: TestUser;
	let room: Room;

	const seed = async (messages: string[], session = fx.admin) => {
		room = await fx.channel(fx.admin, [alice.username]);
		const ids: string[] = [];
		for (const msg of messages) {
			ids.push((await fx.message(session, room._id, msg))._id);
		}
		return ids;
	};

	const clean = (body: object, session = fx.admin) => post('rooms.cleanHistory', { session, body: { roomId: room._id, ...WIDE, ...body } });

	before(async () => {
		fx = await Fixture.create();
		alice = await fx.user('ret');
	});

	after(() => fx.dispose());

	it('returns success and the number of removed messages', async () => {
		await seed(['one', 'two', 'three']);

		const { status, body } = await clean({});

		assert.equal(status, 200);
		assert.equal(body.success, true);
		assert.ok(body.count >= 3);
		assert.deepEqual(await roomTexts(fx.admin, room._id).then((all) => all.filter((t) => ['one', 'two', 'three'].includes(t))), []);
	});

	it('honors limit', async () => {
		await seed(['l1', 'l2', 'l3', 'l4', 'l5']);

		const { body } = await clean({ limit: 2 });
		const left = (await roomTexts(fx.admin, room._id)).filter((t) => /^l\d$/.test(t));

		assert.equal(body.count, 2);
		assert.equal(left.length, 3);
	});

	it('keeps pinned messages when excludePinned is true', async () => {
		const [, pinnedId] = await seed(['plain', 'pinned']);
		await post('chat.pinMessage', { session: fx.admin, body: { messageId: pinnedId } });

		await clean({ excludePinned: true });
		const left = await roomTexts(fx.admin, room._id);

		assert.ok(left.includes('pinned'));
		assert.ok(!left.includes('plain'));
	});

	it('removes pinned messages too when excludePinned is false', async () => {
		const [pinnedId] = await seed(['will be pinned']);
		await post('chat.pinMessage', { session: fx.admin, body: { messageId: pinnedId } });

		await clean({ excludePinned: false });

		assert.ok(!(await roomTexts(fx.admin, room._id)).includes('will be pinned'));
	});

	it('only removes the messages of the users it is given', async () => {
		await seed(['from admin']);
		await fx.message(alice, room._id, 'from alice');

		await clean({ users: [alice.username] });
		const left = await roomTexts(fx.admin, room._id);

		assert.ok(left.includes('from admin'));
		assert.ok(!left.includes('from alice'));
	});

	it('does not touch messages outside the requested window', async () => {
		await seed(['recent']);

		const { status, body } = await clean({ latest: '2001-01-01T00:00:00.000Z', oldest: '2000-01-01T00:00:00.000Z' });

		assert.equal(status, 200);
		assert.equal(body.count, 0);
		assert.ok((await roomTexts(fx.admin, room._id)).includes('recent'));
	});

	it('rejects a request without oldest with 400', async () => {
		await seed(['x']);

		const { status } = await post('rooms.cleanHistory', { session: fx.admin, body: { roomId: room._id, latest: WIDE.latest } });

		assert.equal(status, 400);
	});

	it('rejects a request without roomId with 400', async () => {
		const { status } = await post('rooms.cleanHistory', { session: fx.admin, body: WIDE });

		assert.equal(status, 400);
	});

	it('refuses a user without the permission with 403', async () => {
		await seed(['guarded']);

		const { status } = await clean({}, alice);

		assert.equal(status, 403);
		assert.ok((await roomTexts(fx.admin, room._id)).includes('guarded'));
	});

	it('refuses a private group the user does not belong to with 403', async () => {
		const group = await fx.group(fx.admin, []);

		const { status } = await post('rooms.cleanHistory', { session: alice, body: { roomId: group._id, ...WIDE } });

		assert.equal(status, 403);
	});

	// Pinned on purpose: the two dates are not compared, so an inverted range is an empty selection.
	// When the server starts rejecting it, change this expectation to 400.
	it('currently treats an inverted range as an empty selection', async () => {
		await seed(['survivor']);

		const { status, body } = await clean({ latest: '2001-01-01T00:00:00.000Z', oldest: '2030-01-01T00:00:00.000Z' });

		assert.equal(status, 200);
		assert.equal(body.count, 0);
		assert.ok((await roomTexts(fx.admin, room._id)).includes('survivor'));
	});
});
