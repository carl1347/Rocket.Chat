import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { Room } from '../lib/client.ts';
import { Fixture, call, get, post, roomTexts, uniqueName } from '../lib/client.ts';
import { assertNoInternalsLeaked } from '../lib/security.ts';

type Integration = { _id: string; token: string; userId: string };

describe('Webhooks security regression', () => {
	let fx: Fixture;
	let room: Room;
	let otherRoom: Room;
	let hook: Integration;
	let otherHook: Integration;

	const createHook = async (channel: Room): Promise<Integration> => {
		const { body } = await post('integrations.create', {
			session: fx.admin,
			body: { type: 'webhook-incoming', name: uniqueName('sec-hook'), enabled: true, username: 'rocket.cat', channel: `#${channel.name}`, scriptEnabled: false },
		});
		return body.integration;
	};

	const hookPath = (integration: Integration, token = integration.token) => `/hooks/${integration._id}/${encodeURIComponent(token)}`;

	before(async () => {
		fx = await Fixture.create();
		room = await fx.channel();
		otherRoom = await fx.channel();
		hook = await createHook(room);
		otherHook = await createHook(otherRoom);
	});

	after(async () => {
		for (const integration of [hook, otherHook]) {
			await post('integrations.remove', { session: fx.admin, body: { type: 'webhook-incoming', integrationId: integration._id } });
		}
		await fx.dispose();
	});

	describe('who may publish', () => {
		it('rejects hostile tokens and publishes nothing', async () => {
			const tokens = ['', '0', 'a'.repeat(10_000), '{"$ne":null}', '../../etc/passwd', '%00', "' OR '1'='1"];

			for (const token of tokens) {
				const response = await post(hookPath(hook, token), { body: { text: 'hostile token' } });

				assert.ok(response.status >= 400, `token ${JSON.stringify(token.slice(0, 20))} was accepted with ${response.status}`);
			}
			assert.ok(!(await roomTexts(fx.admin, room._id)).includes('hostile token'));
		});

		it("does not accept the token of one integration on another integration's id", async () => {
			const response = await post(hookPath(hook, otherHook.token), { body: { text: 'crossed tokens' } });

			assert.ok(response.status >= 400);
			assert.ok(!(await roomTexts(fx.admin, room._id)).includes('crossed tokens'));
			assert.ok(!(await roomTexts(fx.admin, otherRoom._id)).includes('crossed tokens'));
		});

		it('answers an unknown id and a wrong token the same way, so ids cannot be probed', async () => {
			const wrongToken = await post(hookPath(hook, 'wrong'), { body: { text: 'x' } });
			const unknownId = await post(`/hooks/${uniqueName('missing')}/wrong`, { body: { text: 'x' } });

			assert.equal(unknownId.status, wrongToken.status);
			assert.equal(unknownId.text, wrongToken.text);
		});

		it('does not echo the token it was given', async () => {
			const secret = 'secret-probe-token-123';

			const response = await post(hookPath(hook, secret), { body: { text: 'x' } });

			assert.ok(!response.text.includes(secret));
		});

		it('errors do not carry stack traces or file paths', async () => {
			assertNoInternalsLeaked(await post(hookPath(hook, 'wrong'), { body: { text: 'x' } }));
			assertNoInternalsLeaked(await call('POST', `/hooks/${hook._id}`, { body: { text: 'x' } }));
		});
	});

	describe('what a valid token may do', () => {
		it('cannot redirect the message to another room unless the integration allows it', async () => {
			const response = await post(hookPath(hook), { body: { text: 'redirected', channel: `#${otherRoom.name}` } });

			assert.equal(response.status, 403);
			assert.ok(!(await roomTexts(fx.admin, otherRoom._id)).includes('redirected'));
		});

		it('cannot change the posting user through the payload', async () => {
			await post(hookPath(hook), { body: { text: 'impersonation', username: 'admin', u: { username: 'admin' } } });

			const { body } = await get('channels.messages', { session: fx.admin, query: { roomId: room._id, count: 100 } });
			const message = body.messages.find((m: { msg: string }) => m.msg === 'impersonation');
			assert.ok(!message || message.u.username === 'rocket.cat', 'the integration user must stay the author');
		});

		it('keeps markup in the text inert and does not fail', async () => {
			const response = await post(hookPath(hook), { body: { text: '<script>alert(1)</script>' } });

			assert.ok(response.status < 500);
		});
	});

	describe('abuse protection', () => {
		it('answers 429 once the rate limit is exceeded', async () => {
			await fx.setting('API_Enable_Rate_Limiter', true);
			await fx.setting('API_Enable_Rate_Limiter_Limit_Calls_Default', 3);
			await fx.setting('API_Enable_Rate_Limiter_Limit_Time_Default', 60_000);

			const statuses: number[] = [];
			for (let i = 0; i < 8; i++) {
				statuses.push((await post(hookPath(hook), { body: { text: `burst ${i}` } })).status);
			}

			assert.ok(statuses.includes(429), `no 429 in ${statuses.join(', ')}; is the server running with TEST_MODE?`);
		});
	});
});
