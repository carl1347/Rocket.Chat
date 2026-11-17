import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { z } from 'zod/v4';

import type { Room } from '../src/api.ts';
import { Fixture, get } from '../src/api.ts';
import { config } from '../src/config.ts';
import { Harness, domText, eventually } from '../src/harness.ts';

const THREAD_LIST = '[role="list"][aria-label="Thread message list"]';

describe('Threads (Stagehand + Ollama)', { timeout: config.testTimeoutMs * 4 }, () => {
	let fx: Fixture;
	let h: Harness;
	let room: Room;
	let parent: { _id: string };

	const replyCount = async () => (await get('chat.getMessage', { session: fx.admin, query: { msgId: parent._id } })).body.message.tcount ?? 0;

	before(async () => {
		fx = await Fixture.create();
		room = await fx.channel();
		parent = await fx.message(fx.admin, room._id, 'Mensaje padre del hilo');
		h = await Harness.start();
		await h.openAs(fx.admin, `/channel/${room.name}`);
	});

	after(async () => {
		await h?.stop();
		await fx?.dispose();
	});

	it('success: replies in a thread from the message actions and the thread panel shows it', { timeout: config.testTimeoutMs }, async () => {
		const page = await h.page();

		await h.stagehand.act('hover over the last message in the room and click its "Reply in thread" button');
		await h.stagehand.act('type "Respuesta guiada por IA" into the thread composer and press Enter');

		assert.equal(await eventually(replyCount, (count) => count >= 1), 1, 'the parent counts exactly one reply');
		const panel = await eventually(() => domText(page, THREAD_LIST), (text) => text.includes('Respuesta guiada por IA'));
		assert.match(panel, /Respuesta guiada por IA/);
	});

	it('alternative: the model can read the thread panel back as structured data', { timeout: config.testTimeoutMs }, async () => {
		const { data } = await h.stagehand.extract(
			'extract the text of every message shown in the thread panel',
			z.object({ messages: z.array(z.string()) }),
		);

		assert.ok(data.messages.some((text) => text.includes('Respuesta guiada por IA')), `read back: ${JSON.stringify(data.messages)}`);
	});

	it('error: pressing Enter on an empty thread composer sends nothing', { timeout: config.testTimeoutMs }, async () => {
		const before = await replyCount();

		await h.stagehand.act('click the thread composer and press Enter without typing anything');
		await new Promise((resolve) => setTimeout(resolve, 2000));

		assert.equal(await replyCount(), before);
	});
});
