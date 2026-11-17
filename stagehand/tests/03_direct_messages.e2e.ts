import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { TestUser } from '../src/api.ts';
import { Fixture, get, post } from '../src/api.ts';
import { config } from '../src/config.ts';
import { Harness, domHas, eventually } from '../src/harness.ts';

describe('Direct messages (Stagehand + Ollama)', { timeout: config.testTimeoutMs * 4 }, () => {
	let fx: Fixture;
	let h: Harness;
	let alice: TestUser;
	let bob: TestUser;

	const directRoomsWithBob = async () => {
		const { body } = await get('im.list', { session: alice });
		return body.ims.filter((room: { usernames: string[] }) => room.usernames.includes(bob.username)) as { _id: string }[];
	};

	before(async () => {
		fx = await Fixture.create();
		alice = await fx.user('sh-dm-a');
		bob = await fx.user('sh-dm-b');
		h = await Harness.start();
	});

	after(async () => {
		await h?.stop();
		await fx?.dispose();
	});

	const openNewDirectMessage = async () => {
		await h.stagehand.act('click the "Create new" button in the top bar and choose "Direct message"');
	};

	it('success: starts a DM from the sidebar, lands on /direct/<id> and sends a message', { timeout: config.testTimeoutMs * 2 }, async () => {
		const page = await h.openAs(alice, '/home');

		await openNewDirectMessage();
		await h.stagehand.act(`type "${bob.username}" into the user selector and choose that user from the suggestions`);
		await h.stagehand.act('click the "Create" button of the dialog');

		const url = await eventually(() => page.url(), (current) => /\/direct\//.test(current), 30_000);
		assert.match(url, /\/direct\/[A-Za-z0-9]+/);

		await h.stagehand.act('type "Hola Bob desde la IA" into the message composer and press Enter');
		const messages = await eventually(
			async () => (await get('im.messages', { session: alice, query: { username: bob.username } })).body.messages as { msg: string }[],
			(list) => list.some((message) => message.msg === 'Hola Bob desde la IA'),
		);
		assert.ok(messages.some((message) => message.msg === 'Hola Bob desde la IA'));
	});

	it('alternative: starting the same conversation again does not duplicate the room', { timeout: config.testTimeoutMs * 2 }, async () => {
		await h.openAs(alice, '/home');

		await openNewDirectMessage();
		await h.stagehand.act(`type "${bob.username}" into the user selector and choose that user from the suggestions`);
		await h.stagehand.act('click the "Create" button of the dialog');
		await new Promise((resolve) => setTimeout(resolve, 3000));

		assert.equal((await directRoomsWithBob()).length, 1);
	});

	it('error: a username that does not exist offers no user to pick', { timeout: config.testTimeoutMs }, async () => {
		const page = await h.openAs(alice, '/home');

		await openNewDirectMessage();
		await h.stagehand.act('type "usuario-que-no-existe-xyz" into the user selector');
		await new Promise((resolve) => setTimeout(resolve, 2000));

		assert.equal(await domHas(page, '[role="option"]'), false);
		assert.equal((await post('im.create', { session: alice, body: { username: 'usuario-que-no-existe-xyz' } })).status, 400);
	});
});
