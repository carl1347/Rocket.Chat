import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { z } from 'zod/v4';

import type { Room } from '../src/api.ts';
import { Fixture, call, post, roomTexts, uniqueName } from '../src/api.ts';
import { config } from '../src/config.ts';
import { Harness, domText, eventually } from '../src/harness.ts';

const LAST_MESSAGE = '[role="listitem"][aria-roledescription="message"]:last-of-type';

describe('Webhooks (Stagehand + Ollama)', { timeout: config.testTimeoutMs * 4 }, () => {
	let fx: Fixture;
	let h: Harness;
	let room: Room;
	let hook: { _id: string; token: string; name: string };

	before(async () => {
		fx = await Fixture.create();
		room = await fx.channel();
		const name = uniqueName('sh-hook');
		const { body } = await post('integrations.create', {
			session: fx.admin,
			body: { type: 'webhook-incoming', name, enabled: true, username: 'rocket.cat', channel: `#${room.name}`, scriptEnabled: false },
		});
		hook = { _id: body.integration._id, token: body.integration.token, name };
		h = await Harness.start();
	});

	after(async () => {
		await post('integrations.remove', { session: fx.admin, body: { type: 'webhook-incoming', integrationId: hook._id } });
		await h?.stop();
		await fx?.dispose();
	});

	it('success: a webhook message shows up in the room and the model reads rocket.cat as its author', { timeout: config.testTimeoutMs }, async () => {
		const response = await post(`/hooks/${hook._id}/${hook.token}`, { body: { text: 'Mensaje automatizado por webhook' } });
		assert.equal(response.status, 200);

		const page = await h.openAs(fx.admin, `/channel/${room.name}`);
		const shown = await eventually(() => domText(page, LAST_MESSAGE), (text) => text.includes('Mensaje automatizado por webhook'));
		assert.match(shown, /rocket\.cat/);

		const { data } = await h.stagehand.extract('extract the author name and the text of the last message in the room', z.object({ author: z.string(), text: z.string() }));
		assert.match(data.author, /rocket\.cat/i, `read back: ${JSON.stringify(data)}`);
		assert.match(data.text, /Mensaje automatizado/);
	});

	it('alternative: the model finds the integration in the administration screen', { timeout: config.testTimeoutMs * 2 }, async () => {
		const page = await h.openAs(fx.admin, '/admin/integrations');

		await h.stagehand.act(`open the incoming webhook named "${hook.name}" from the list`);

		const url = await eventually(() => page.url(), (current) => current.includes(hook._id), 30_000);
		assert.ok(url.includes(hook._id), `ended on ${url}`);
	});

	it('error: a corrupted token publishes nothing and the model sees no such message', { timeout: config.testTimeoutMs }, async () => {
		const response = await call('POST', `/hooks/${hook._id}/${hook.token}-corrupto`, { body: { text: 'No debe publicarse' } });
		assert.ok(response.status >= 400);

		await h.openAs(fx.admin, `/channel/${room.name}`);
		const modelSeesIt = await h.asks('Is there a message with the text "No debe publicarse" in the room?');

		assert.equal(modelSeesIt, false);
		assert.ok(!(await roomTexts(fx.admin, room._id)).includes('No debe publicarse'));
	});
});
