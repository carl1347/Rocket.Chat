import { post } from '../lib/client.ts';
import { runFeature } from './lib.ts';

await runFeature('direct-messages', async (fx) => {
	const alice = await fx.user('perf-dm-a');
	const bob = await fx.user('perf-dm-b');
	const rid = (await post('im.create', { session: alice, body: { username: bob.username } })).body.room.rid as string;
	for (let i = 0; i < 20; i++) {
		await fx.message(alice, rid, `perf dm ${i}`);
	}

	return [
		{ name: 'im.create (existing pair)', method: 'POST', path: 'im.create', session: alice, body: { username: bob.username } },
		{ name: 'im.list', method: 'GET', path: 'im.list', session: alice },
		{ name: 'im.messages', method: 'GET', path: `im.messages?roomId=${rid}`, session: alice },
	];
});
