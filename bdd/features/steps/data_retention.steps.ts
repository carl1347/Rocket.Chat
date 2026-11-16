import { Then, When } from '@cucumber/cucumber';
import { Ensure, contain, equals, not } from '@serenity-js/assertions';
import { Duration, Wait, actorCalled, actorInTheSpotlight } from '@serenity-js/core';
import { LastResponse } from '@serenity-js/rest';

import { context } from '../../src/context';
import { RocketChatApi } from '../../src/screenplay/interactions/RocketChatApi';
import { TextsOfTheMessagesInTheRoom } from '../../src/screenplay/questions';
import { OpenTheRoom, PruneTheRoom } from '../../src/screenplay/tasks/ui';

const EVERYTHING = { latest: '9999-12-31T23:59:59.000Z', oldest: '0001-01-01T00:00:00.000Z' };

const cleanHistory = (description: string, body: () => object) =>
	RocketChatApi.postLater(description, 'rooms.cleanHistory', () => ({ roomId: context.currentRoom._id, ...body() }));

When('{word} poda la sala desde el menú contextual conservando los mensajes fijados', async (name: string) => {
	await actorCalled(name).attemptsTo(OpenTheRoom(), PruneTheRoom.keepingPinnedMessages());
});

When('{word} limpia el historial por la API con excludePinned en {word}', async (name: string, excludePinned: string) => {
	await actorCalled(name).attemptsTo(cleanHistory('#actor cleans the history through the API', () => ({ ...EVERYTHING, excludePinned: excludePinned === 'true' })));
});

When('{word} limpia el historial por la API sin la fecha oldest', async (name: string) => {
	await actorCalled(name).attemptsTo(cleanHistory('#actor cleans the history without the oldest date', () => ({ latest: EVERYTHING.latest })));
});

When('{word} limpia el historial por la API con las fechas invertidas', async (name: string) => {
	await actorCalled(name).attemptsTo(
		cleanHistory('#actor cleans the history with latest before oldest', () => ({ latest: '2001-01-01T00:00:00.000Z', oldest: '2030-01-01T00:00:00.000Z' })),
	);
});

Then('la sala conserva el mensaje {string}', async (text: string) => {
	await actorInTheSpotlight().attemptsTo(Ensure.that(TextsOfTheMessagesInTheRoom(), contain(text)));
});

Then('la sala ya no contiene el mensaje {string}', async (text: string) => {
	await actorInTheSpotlight().attemptsTo(Wait.upTo(Duration.ofSeconds(15)).until(TextsOfTheMessagesInTheRoom(), not(contain(text))));
});

Then('la API informa que se eliminaron {int} mensajes', async (count: number) => {
	await actorInTheSpotlight().attemptsTo(Ensure.that(LastResponse.body<{ count: number }>().count, equals(count)));
});
