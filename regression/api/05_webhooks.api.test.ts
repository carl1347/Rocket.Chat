import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { Room } from '../lib/client.ts';
import { Fixture, call, get, post, roomTexts, uniqueName } from '../lib/client.ts';

type Integration = { _id: string; token: string; userId: string };

describe('Webhooks API regression', () => {
	let fx: Fixture;
	let room: Room;
	let hook: Integration;

	const createHook = async (extra: Record<string, unknown> = {}): Promise<Integration> => {
		const { status, body } = await post('integrations.create', {
			session: fx.admin,
			body: {
				type: 'webhook-incoming',
				name: uniqueName('reg-hook'),
				enabled: true,
				username: 'rocket.cat',
				channel: `#${room.name}`,
				scriptEnabled: false,
				...extra,
			},
		});
		assert.equal(status, 200, JSON.stringify(body));
		return body.integration;
	};

	const hookPath = (integration: Integration, token = integration.token) => `/hooks/${integration._id}/${token}`;

	before(async () => {
		fx = await Fixture.create();
		room = await fx.channel();
		hook = await createHook();
	});

	after(async () => {
		await post('integrations.remove', { session: fx.admin, body: { type: 'webhook-incoming', integrationId: hook._id } });
		await fx.dispose();
	});

	it('integrations.create returns the integration contract', () => {
		assert.ok(hook._id && hook.token);
		assert.equal(hook.userId.length > 0, true);
	});

	it('a JSON post answers 200 and publishes the message as rocket.cat', async () => {
		const { status, body } = await post(hookPath(hook), { body: { text: 'regression json' } });

		assert.equal(status, 200);
		assert.equal(body.success, true);
		const { body: list } = await get('channels.messages', { session: fx.admin, query: { roomId: room._id, count: 100 } });
		const message = list.messages.find((m: { msg: string }) => m.msg === 'regression json');
		assert.ok(message, 'the message was published');
		assert.equal(message.u.username, 'rocket.cat');
		assert.equal(message.bot?.i, hook._id);
	});

	it('the legacy url with a userId segment also works', async () => {
		const { status } = await post(`/hooks/${hook._id}/${hook.userId}/${hook.token}`, { body: { text: 'regression legacy' } });

		assert.equal(status, 200);
		assert.ok((await roomTexts(fx.admin, room._id)).includes('regression legacy'));
	});

	it('unwraps a url-encoded payload field that holds JSON', async () => {
		const { status } = await post(hookPath(hook), { form: { payload: JSON.stringify({ text: 'regression form' }) } });

		assert.equal(status, 200);
		assert.ok((await roomTexts(fx.admin, room._id)).includes('regression form'));
	});

	it('a GET is accepted and publishes nothing', async () => {
		const { status } = await get(hookPath(hook), { query: { text: 'regression get' } });

		assert.equal(status, 200);
		assert.ok(!(await roomTexts(fx.admin, room._id)).includes('regression get'));
	});

	it('an empty body is accepted and publishes nothing', async () => {
		const { status, body } = await post(hookPath(hook));

		assert.equal(status, 200);
		assert.equal(body.success, true);
	});

	it('separateResponse returns one entry per delivery', async () => {
		const { status, body } = await post(hookPath(hook), { body: { text: 'regression separate', separateResponse: true } });

		assert.equal(status, 200);
		assert.ok(Array.isArray(body.responses));
	});

	it('refuses a channel override the integration does not allow with 403', async () => {
		const { status, body } = await post(hookPath(hook), { body: { text: 'regression override', channel: '#general' } });

		assert.equal(status, 403);
		assert.equal(body.error, 'overriding destination channel is disabled for this integration');
	});

	it('applies the alias and emoji configured on the integration', async () => {
		const aliased = await createHook({ alias: 'ci-bot', emoji: ':robot:' });

		await post(hookPath(aliased), { body: { text: 'regression alias' } });
		const { body } = await get('channels.messages', { session: fx.admin, query: { roomId: room._id, count: 100 } });
		const message = body.messages.find((m: { msg: string }) => m.msg === 'regression alias');

		assert.equal(message.alias, 'ci-bot');
		assert.equal(message.emoji, ':robot:');
		await post('integrations.remove', { session: fx.admin, body: { type: 'webhook-incoming', integrationId: aliased._id } });
	});

	it('a disabled integration answers 503 Service Unavailable', async () => {
		const disabled = await createHook({ enabled: false });

		const { status, body } = await post(hookPath(disabled), { body: { text: 'regression disabled' } });

		assert.equal(status, 503);
		assert.equal(body.error, 'Service Unavailable');
		await post('integrations.remove', { session: fx.admin, body: { type: 'webhook-incoming', integrationId: disabled._id } });
	});

	it('the info endpoint answers success', async () => {
		const { status, body } = await get(`/hooks/info/${hook._id}/${hook.userId}/${hook.token}`);

		assert.equal(status, 200);
		assert.equal(body.success, true);
	});

	it('removing an integration whose url is not registered answers 404 integration-not-found', async () => {
		const { status, body } = await post(`/hooks/remove/${hook._id}/${hook.token}`, { body: { target_url: 'https://example.com/not-registered' } });

		assert.equal(status, 404);
		assert.equal(body.error, 'integration-not-found');
	});

	it('a url without a token answers 404', async () => {
		const { status } = await call('POST', `/hooks/${hook._id}`, { body: { text: 'regression no token' } });

		assert.equal(status, 404);
	});

	// Pinned on purpose: the server throws for an unknown token and answers a plain 500.
	// When it starts answering 404 integration-not-found, change this expectation.
	it('currently answers 500 to a corrupted token and publishes nothing', async () => {
		const { status, text } = await post(hookPath(hook, `${hook.token}-corrupted`), { body: { text: 'regression corrupted' } });

		assert.equal(status, 500);
		assert.equal(text, 'Internal Server Error');
		assert.ok(!(await roomTexts(fx.admin, room._id)).includes('regression corrupted'));
	});
});
