import { runFeature } from './lib.ts';

await runFeature('data-retention', async (fx) => {
	const alice = await fx.user('perf-ret');
	const room = await fx.channel(fx.admin, [alice.username]);
	for (let i = 0; i < 20; i++) {
		await fx.message(fx.admin, room._id, `perf retention ${i}`);
	}

	return [
		{
			// the window is in the past, so the request exercises validation and selection without deleting
			name: 'rooms.cleanHistory (empty window)',
			method: 'POST',
			path: 'rooms.cleanHistory',
			session: fx.admin,
			body: { roomId: room._id, latest: '2001-01-01T00:00:00.000Z', oldest: '2000-01-01T00:00:00.000Z', excludePinned: true },
		},
		{
			name: 'rooms.cleanHistory refused to a standard user',
			method: 'POST',
			path: 'rooms.cleanHistory',
			session: alice,
			body: { roomId: room._id, latest: '2001-01-01T00:00:00.000Z', oldest: '2000-01-01T00:00:00.000Z' },
			expectedStatus: 403,
		},
	];
});
