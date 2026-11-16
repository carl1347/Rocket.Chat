import { Given, Then, When } from '@cucumber/cucumber';
import { Ensure, equals, includes, startsWith } from '@serenity-js/assertions';
import { Interaction, Wait, actorCalled, actorInTheSpotlight } from '@serenity-js/core';
import { Text } from '@serenity-js/web';

import { context } from '../../src/context';
import { RocketChatApi, send } from '../../src/screenplay/interactions/RocketChatApi';
import { DirectRoomIdsWith } from '../../src/screenplay/questions';
import { LimitDirectMessageMembersTo } from '../../src/screenplay/tasks/api';
import { CurrentPathname, SendMessageInTheRoom, StartDirectMessageWith } from '../../src/screenplay/tasks/ui';
import * as Ui from '../../src/screenplay/ui/RocketChatUi';
import { administrator } from '../support/serenity.config';

const createDirectMessage = (times: number, withLabel: string) =>
	Interaction.where(`#actor creates a direct message with ${withLabel} ${times} times`, async (actor) => {
		for (let i = 0; i < times; i++) {
			const { data } = await send(actor, { method: 'POST', url: 'im.create', data: { username: context.users[withLabel].username } });
			context.lastRoomIds.push(data.room.rid);
		}
	});

Given('que el límite de miembros de un mensaje directo es {int}', async (limit: number) => {
	const admin = await administrator();
	await admin.attemptsTo(LimitDirectMessageMembersTo(limit));
});

When('{word} inicia un mensaje directo con {word} desde la barra lateral', async (name: string, other: string) => {
	await actorCalled(name).attemptsTo(StartDirectMessageWith(other));
});

Then('la conversación se abre en una ruta que empieza por {string}', async (prefix: string) => {
	await actorInTheSpotlight().attemptsTo(Wait.until(CurrentPathname(), startsWith(prefix)));
});

When('{word} envía {string} en la conversación', async (name: string, text: string) => {
	await actorCalled(name).attemptsTo(SendMessageInTheRoom(text));
});

Then('la conversación muestra {string}', async (text: string) => {
	await actorInTheSpotlight().attemptsTo(Wait.until(Text.of(Ui.LastMessage), includes(text)));
});

When('{word} crea por la API un mensaje directo con {word} {int} veces', async (name: string, other: string, times: number) => {
	await actorCalled(name).attemptsTo(createDirectMessage(times, other));
});

Then('todas las respuestas devuelven la misma sala', () => {
	const unique = new Set(context.lastRoomIds);
	if (context.lastRoomIds.length < 2 || unique.size !== 1) {
		throw new Error(`Expected the same room every time but got: ${context.lastRoomIds.join(', ')}`);
	}
});

Then('{word} tiene {int} sala directa con {word}', async (name: string, count: number, other: string) => {
	await actorCalled(name).attemptsTo(Ensure.that(DirectRoomIdsWith(other).length, equals(count)));
});

When('{word} intenta crear un mensaje directo con un usuario inexistente', async (name: string) => {
	await actorCalled(name).attemptsTo(RocketChatApi.post('im.create', { username: 'bdd-usuario-que-no-existe' }));
});

When('{word} intenta crear un mensaje directo con {word} y {word}', async (name: string, first: string, second: string) => {
	await actorCalled(name).attemptsTo(
		RocketChatApi.postLater('#actor tries to create a direct message with too many members', 'im.create', () => ({
			usernames: `${context.users[first].username},${context.users[second].username}`,
		})),
	);
});
