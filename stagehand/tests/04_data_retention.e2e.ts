import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { z } from 'zod/v4';

import type { Room, TestUser } from '../src/api.ts';
import { Fixture, post, roomTexts } from '../src/api.ts';
import { config } from '../src/config.ts';
import { Harness, eventually, menuHas } from '../src/harness.ts';

describe('Data retention (Stagehand + Ollama)', { timeout: config.testTimeoutMs * 4 }, () => {
	let fx: Fixture;
	let h: Harness;
	let alice: TestUser;
	let room: Room;

	const seedRoom = async () => {
		room = await fx.channel(fx.admin, [alice.username]);
		await fx.message(fx.admin, room._id, 'Mensaje normal');
		const pinned = await fx.message(fx.admin, room._id, 'Mensaje fijado');
		await post('chat.pinMessage', { session: fx.admin, body: { messageId: pinned._id } });
	};

	before(async () => {
		fx = await Fixture.create();
		alice = await fx.user('sh-ret');
		h = await Harness.start();
	});

	after(async () => {
		await h?.stop();
		await fx?.dispose();
	});

	it('success: prunes from the room menu keeping pinned messages', { timeout: config.testTimeoutMs * 2 }, async () => {
		await seedRoom();
		await h.openAs(fx.admin, `/channel/${room.name}`);

		await h.stagehand.act('click the "Options" button in the room toolbar and choose "Prune messages"');
		await h.stagehand.act('tick the checkbox "Do not prune pinned messages"');
		await h.stagehand.act('click the "Prune" button and then confirm with "Yes, prune them!"');

		const texts = await eventually(() => roomTexts(fx.admin, room._id), (list) => !list.includes('Mensaje normal'));
		assert.ok(!texts.includes('Mensaje normal'));
		assert.ok(texts.includes('Mensaje fijado'));
	});

	it('alternative: the model reads back that only the pinned message is left', { timeout: config.testTimeoutMs }, async () => {
		await h.stagehand.act('close the prune panel if it is open');
		const { data } = await h.stagehand.extract('extract the text of every message in the room', z.object({ messages: z.array(z.string()) }));

		assert.ok(data.messages.some((text) => text.includes('Mensaje fijado')), `read back: ${JSON.stringify(data.messages)}`);
		assert.ok(!data.messages.some((text) => text.includes('Mensaje normal')), `read back: ${JSON.stringify(data.messages)}`);
	});

	it('error: a standard user cannot prune and the history stays intact', { timeout: config.testTimeoutMs }, async () => {
		await seedRoom();
		const page = await h.openAs(alice, `/channel/${room.name}`);

		await h.stagehand.act('click the "Options" button in the room toolbar to open the room menu');

		assert.equal(await menuHas(page, 'Prune messages'), false);
		assert.ok((await roomTexts(fx.admin, room._id)).includes('Mensaje normal'));
	});
});
