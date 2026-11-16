import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { Room, TestUser } from '../lib/client.ts';
import { Fixture, get, post } from '../lib/client.ts';

const WIDE = { latest: '9999-12-31T23:59:59.000Z', oldest: '0001-01-01T00:00:00.000Z' };

describe('RBAC API regression', () => {
	let fx: Fixture;
	let alice: TestUser;
	let room: Room;

	before(async () => {
		fx = await Fixture.create();
		alice = await fx.user('rbac');
		room = await fx.channel(fx.admin, [alice.username]);
	});

	after(() => fx.dispose());

	it('permissions.listAll returns the permission matrix to an admin', async () => {
		const { status, body } = await get('permissions.listAll', { session: fx.admin });

		assert.equal(status, 200);
		assert.ok(Array.isArray(body.update));
		const permission = body.update.find((entry: { _id: string }) => entry._id === 'clean-channel-history');
		assert.ok(permission, 'clean-channel-history is defined');
		assert.ok(permission.roles.includes('admin'));
	});

	it('roles.list includes the built-in roles', async () => {
		const { status, body } = await get('roles.list', { session: fx.admin });
		const ids = body.roles.map((role: { _id: string }) => role._id);

		assert.equal(status, 200);
		for (const role of ['admin', 'user', 'moderator', 'owner']) {
			assert.ok(ids.includes(role), `missing role ${role}`);
		}
	});

	it('granting and revoking a role is reflected in users.info', async () => {
		const grant = await post('roles.addUserToRole', { session: fx.admin, body: { roleName: 'moderator', username: alice.username } });
		const granted = await get('users.info', { session: fx.admin, query: { userId: alice._id } });
		const revoke = await post('roles.removeUserFromRole', { session: fx.admin, body: { roleName: 'moderator', username: alice.username } });
		const revoked = await get('users.info', { session: fx.admin, query: { userId: alice._id } });

		assert.equal(grant.status, 200);
		assert.ok(granted.body.user.roles.includes('moderator'));
		assert.equal(revoke.status, 200);
		assert.ok(!revoked.body.user.roles.includes('moderator'));
	});

	it('an admin can clean the history of a room', async () => {
		const { status, body } = await post('rooms.cleanHistory', { session: fx.admin, body: { roomId: room._id, ...WIDE } });

		assert.equal(status, 200);
		assert.equal(typeof body.count, 'number');
	});

	it('a standard user gets 403 error-forbidden from rooms.cleanHistory', async () => {
		const { status, body } = await post('rooms.cleanHistory', { session: alice, body: { roomId: room._id, ...WIDE } });

		assert.equal(status, 403);
		assert.equal(body.success, false);
		assert.equal(body.errorType, 'error-forbidden');
	});

	it('a standard user cannot change permissions', async () => {
		const { status } = await post('permissions.update', {
			session: alice,
			body: { permissions: [{ _id: 'clean-channel-history', roles: ['user'] }] },
		});

		assert.ok([401, 403].includes(status), `expected 401 or 403, got ${status}`);
	});

	it('a standard user cannot grant roles', async () => {
		const { status } = await post('roles.addUserToRole', { session: alice, body: { roleName: 'admin', username: alice.username } });

		assert.ok([401, 403].includes(status), `expected 401 or 403, got ${status}`);
	});

	it('a request without credentials gets 401', async () => {
		const { status } = await get('permissions.listAll');

		assert.equal(status, 401);
	});
});
