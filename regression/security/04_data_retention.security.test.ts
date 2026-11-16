import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { Room, Session, TestUser } from '../lib/client.ts';
import { Fixture, call, get, post, roomTexts } from '../lib/client.ts';
import { NOSQL_OPERATORS, assertNoInternalsLeaked, assertNoServerError, assertRejected, forgedToken } from '../lib/security.ts';

const WIDE = { latest: '9999-12-31T23:59:59.000Z', oldest: '0001-01-01T00:00:00.000Z' };

describe('Data retention security regression', () => {
	let fx: Fixture;
	let alice: TestUser;
	let room: Room;
	let privateRoom: Room;

	before(async () => {
		fx = await Fixture.create();
		alice = await fx.user('ret');
		room = await fx.channel(fx.admin, [alice.username]);
		privateRoom = await fx.group(fx.admin, []);
		await fx.message(fx.admin, room._id, 'keep me');
		await fx.message(fx.admin, privateRoom._id, 'keep me private');
	});

	after(() => fx.dispose());

	const clean = (session: Pick<Session, 'userId' | 'authToken'> | undefined, body: object) => post('rooms.cleanHistory', { session, body });

	describe('who may delete', () => {
		it('rejects a request with no credentials', async () => {
			assert.equal((await clean(undefined, { roomId: room._id, ...WIDE })).status, 401);
		});

		it('rejects a forged token', async () => {
			assert.equal((await clean(forgedToken(alice), { roomId: room._id, ...WIDE })).status, 401);
		});

		it('refuses a standard user and leaves the data intact', async () => {
			assert.equal((await clean(alice, { roomId: room._id, ...WIDE })).status, 403);

			assert.ok((await roomTexts(fx.admin, room._id)).includes('keep me'));
		});

		it('refuses a user who cannot see the private room and leaves it intact', async () => {
			assertRejected(await clean(alice, { roomId: privateRoom._id, ...WIDE }), [403, 404]);

			const { body } = await get('groups.messages', { session: fx.admin, query: { roomId: privateRoom._id, count: 100 } });
			assert.ok(body.messages.some((m: { msg: string }) => m.msg === 'keep me private'));
		});

		it('does not accept the delete as a GET', async () => {
			const response = await call('GET', `rooms.cleanHistory`, { session: fx.admin, query: { roomId: room._id, ...WIDE } });

			assert.notEqual(response.status, 200);
			assertNoServerError(response);
			assert.ok((await roomTexts(fx.admin, room._id)).includes('keep me'));
		});
	});

	describe('input handling', () => {
		it('rejects operator-style roomId, users and limit without deleting anything', async () => {
			for (const operator of NOSQL_OPERATORS) {
				for (const body of [
					{ roomId: operator, ...WIDE },
					{ roomId: room._id, ...WIDE, users: [operator] },
					{ roomId: room._id, ...WIDE, limit: operator },
				]) {
					const response = await clean(fx.admin, body);

					assertNoServerError(response);
					assertRejected(response);
				}
			}
			assert.ok((await roomTexts(fx.admin, room._id)).includes('keep me'));
		});

		it('rejects a non-numeric limit', async () => {
			assertRejected(await clean(fx.admin, { roomId: room._id, ...WIDE, limit: 'all' }));
		});

		it('does not answer an unparseable date with a server error', async () => {
			for (const latest of ['not-a-date', '99999-99-99', '']) {
				const response = await clean(fx.admin, { roomId: room._id, latest, oldest: WIDE.oldest });

				assertNoServerError(response);
			}
			assert.ok((await roomTexts(fx.admin, room._id)).includes('keep me'));
		});

		it('errors do not carry stack traces or file paths', async () => {
			const response = await clean(fx.admin, { roomId: 'room-that-does-not-exist', ...WIDE });

			assertNoInternalsLeaked(response);
		});
	});
});
