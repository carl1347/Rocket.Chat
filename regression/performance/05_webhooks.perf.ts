import { post, uniqueName } from '../lib/client.ts';
import { runFeature } from './lib.ts';

await runFeature('webhooks', async (fx) => {
	const room = await fx.channel();
	const { body } = await post('integrations.create', {
		session: fx.admin,
		body: { type: 'webhook-incoming', name: uniqueName('perf-hook'), enabled: true, username: 'rocket.cat', channel: `#${room.name}`, scriptEnabled: false },
	});
	const { _id, token, userId } = body.integration;

	return [
		{ name: 'POST /hooks/<id>/<token> (publishes)', method: 'POST', path: `/hooks/${_id}/${token}`, body: { text: 'perf webhook' } },
		{ name: 'GET /hooks/<id>/<token> (accepted, no message)', method: 'GET', path: `/hooks/${_id}/${token}` },
		{ name: 'GET /hooks/info/<id>/<userId>/<token>', method: 'GET', path: `/hooks/info/${_id}/${userId}/${token}` },
	];
});
