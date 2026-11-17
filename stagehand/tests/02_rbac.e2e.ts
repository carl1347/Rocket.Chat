import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { Room, TestUser } from '../src/api.ts';
import { Fixture } from '../src/api.ts';
import { config } from '../src/config.ts';
import { Harness, domHas, menuHas } from '../src/harness.ts';

const PRUNE_DIALOG = '[role="dialog"][aria-label="Prune messages"]';

describe('RBAC (Stagehand + Ollama)', { timeout: config.testTimeoutMs * 4 }, () => {
	let fx: Fixture;
	let h: Harness;
	let alice: TestUser;
	let room: Room;

	before(async () => {
		fx = await Fixture.create();
		alice = await fx.user('sh-rbac');
		room = await fx.channel(fx.admin, [alice.username]);
		await fx.message(fx.admin, room._id, 'Mensaje del propietario');
		h = await Harness.start();
	});

	after(async () => {
		await h?.stop();
		await fx?.dispose();
	});

	const openRoomMenu = () => h.stagehand.act('click the "Options" button in the room toolbar to open the room menu');

	it('success: an admin finds the prune option in the room menu', { timeout: config.testTimeoutMs }, async () => {
		const page = await h.openAs(fx.admin, `/channel/${room.name}`);

		await openRoomMenu();

		assert.equal(await menuHas(page, 'Prune messages'), true);
	});

	it('alternative: a standard user does not get the prune option', { timeout: config.testTimeoutMs }, async () => {
		const page = await h.openAs(alice, `/channel/${room.name}`);

		await openRoomMenu();

		assert.equal(await menuHas(page, 'Prune messages'), false);
		const modelAgrees = await h.asks('Is there a menu item called "Prune messages" visible on the screen?');
		console.log(`  the model ${modelAgrees ? 'disagrees' : 'agrees'} that the option is absent`);
	});

	it('error: a standard user who opens the prune address directly gets no prune panel', { timeout: config.testTimeoutMs }, async () => {
		const page = await h.openAs(alice, `/channel/${room.name}/clean-history`);
		await new Promise((resolve) => setTimeout(resolve, 3000));

		assert.equal(await domHas(page, PRUNE_DIALOG), false);
	});
});
