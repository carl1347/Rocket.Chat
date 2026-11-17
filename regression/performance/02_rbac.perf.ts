import { runFeature } from './lib.ts';

await runFeature('rbac', async (fx) => {
	const alice = await fx.user('perf-rbac');
	const room = await fx.channel(fx.admin, [alice.username]);

	return [
		{ name: 'permissions.listAll', method: 'GET', path: 'permissions.listAll', session: fx.admin },
		{ name: 'roles.list', method: 'GET', path: 'roles.list', session: fx.admin },
		{ name: 'me', method: 'GET', path: 'me', session: alice },
		{
			name: 'rooms.cleanHistory refused to a standard user',
			method: 'POST',
			path: 'rooms.cleanHistory',
			session: alice,
			body: { roomId: room._id, latest: '9999-12-31T23:59:59.000Z', oldest: '0001-01-01T00:00:00.000Z' },
			expectedStatus: 403,
		},
	];
});
