import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { Room, TestUser } from '../lib/client.ts';
import { Fixture, get, post } from '../lib/client.ts';
import { NOSQL_OPERATORS, assertNoServerError, assertRejected, forgedToken } from '../lib/security.ts';

describe('RBAC security regression', () => {
	let fx: Fixture;
	let alice: TestUser;
	let bob: TestUser;
	let room: Room;

	before(async () => {
		fx = await Fixture.create();
		alice = await fx.user('sec-a');
		bob = await fx.user('sec-b');
		room = await fx.channel(fx.admin, [alice.username, bob.username]);
	});

	after(() => fx.dispose());

	const rolesOf = async (user: TestUser) => (await get('users.info', { session: fx.admin, query: { userId: user._id } })).body.user.roles as string[];

	describe('vertical privilege escalation', () => {
		it('a standard user cannot grant themselves the admin role', async () => {
			assertRejected(await post('roles.addUserToRole', { session: alice, body: { roleName: 'admin', username: alice.username } }), [400, 401, 403]);

			assert.ok(!(await rolesOf(alice)).includes('admin'));
		});

		it('a standard user cannot add roles through users.update', async () => {
			assertRejected(await post('users.update', { session: alice, body: { userId: alice._id, data: { roles: ['admin'] } } }), [400, 401, 403]);

			assert.ok(!(await rolesOf(alice)).includes('admin'));
		});

		it('roles sent to the own-profile endpoint are ignored or refused', async () => {
			const response = await post('users.updateOwnBasicInfo', { session: alice, body: { data: { roles: ['admin'] } } });

			assertNoServerError(response);
			assert.ok(!(await rolesOf(alice)).includes('admin'));
		});

		it('a standard user cannot change server settings', async () => {
			const before = (await get('settings/Site_Name', { session: fx.admin })).body.value;

			assertRejected(await post('settings/Site_Name', { session: alice, body: { value: 'pwned' } }), [400, 401, 403]);

			assert.equal((await get('settings/Site_Name', { session: fx.admin })).body.value, before);
		});

		it('a standard user cannot reach admin-only endpoints', async () => {
			const attempts = [
				post('users.create', { session: alice, body: { email: 'x@example.com', name: 'x', username: 'x-sec', password: 'Pw-x-1234!' } }),
				post('integrations.create', { session: alice, body: { type: 'webhook-incoming', name: 'x', enabled: true, username: 'rocket.cat', channel: '#general', scriptEnabled: false } }),
				post('permissions.update', { session: alice, body: { permissions: [{ _id: 'clean-channel-history', roles: ['user'] }] } }),
			];

			for (const response of await Promise.all(attempts)) {
				assertRejected(response, [400, 401, 403]);
			}
		});
	});

	describe('horizontal access', () => {
		it("a standard user cannot delete another user's account", async () => {
			assertRejected(await post('users.delete', { session: alice, body: { userId: bob._id } }), [400, 401, 403]);

			assert.equal((await get('users.info', { session: fx.admin, query: { userId: bob._id } })).status, 200);
		});

		it('a standard user cannot clean the history of a room they do not moderate', async () => {
			await fx.message(fx.admin, room._id, 'must survive');

			const response = await post('rooms.cleanHistory', {
				session: alice,
				body: { roomId: room._id, latest: '9999-12-31T23:59:59.000Z', oldest: '0001-01-01T00:00:00.000Z' },
			});

			assert.equal(response.status, 403);
			const { body } = await get('channels.messages', { session: fx.admin, query: { roomId: room._id, count: 100 } });
			assert.ok(body.messages.some((m: { msg: string }) => m.msg === 'must survive'));
		});
	});

	describe('authentication', () => {
		it('rejects unauthenticated calls to protected endpoints', async () => {
			for (const path of ['permissions.listAll', 'roles.list', 'users.info']) {
				assert.equal((await get(path)).status, 401, path);
			}
		});

		it('rejects a forged token', async () => {
			assert.equal((await get('me', { session: forgedToken(alice) })).status, 401);
		});

		it('a token stops working after logout', async () => {
			const fresh = (await post('login', { body: { user: alice.username, password: alice.password } })).body.data;
			const session = { userId: fresh.userId, authToken: fresh.authToken };
			assert.equal((await get('me', { session })).status, 200);

			await post('logout', { session });

			assert.equal((await get('me', { session })).status, 401);
		});

		it('answers a wrong password and an unknown user the same way', async () => {
			const wrongPassword = await post('login', { body: { user: alice.username, password: 'not-the-password' } });
			const unknownUser = await post('login', { body: { user: 'sec-user-that-does-not-exist', password: 'not-the-password' } });

			assert.equal(wrongPassword.status, 401);
			assert.equal(unknownUser.status, wrongPassword.status);
		});

		it('does not log anyone in with operator-style credentials', async () => {
			for (const operator of NOSQL_OPERATORS) {
				const response = await post('login', { body: { user: operator, password: operator } });

				assertNoServerError(response);
				assert.notEqual(response.status, 200);
			}
		});
	});
});
