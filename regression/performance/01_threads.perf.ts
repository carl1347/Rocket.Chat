import { runFeature } from './lib.ts';

await runFeature('threads', async (fx) => {
	const room = await fx.channel();
	const parent = await fx.message(fx.admin, room._id, 'perf parent');
	for (let i = 0; i < 20; i++) {
		await fx.message(fx.admin, room._id, `perf reply ${i}`, { tmid: parent._id });
	}

	return [
		{ name: 'chat.getThreadMessages', method: 'GET', path: `chat.getThreadMessages?tmid=${parent._id}`, session: fx.admin },
		{ name: 'chat.getThreadsList', method: 'GET', path: `chat.getThreadsList?rid=${room._id}`, session: fx.admin },
		{
			name: 'chat.sendMessage (thread reply)',
			method: 'POST',
			path: 'chat.sendMessage',
			session: fx.admin,
			body: { message: { rid: room._id, msg: 'perf load reply', tmid: parent._id } },
		},
	];
});
