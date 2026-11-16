import { Given, Then } from '@cucumber/cucumber';
import { Ensure, equals, includes } from '@serenity-js/assertions';
import { actorCalled, actorInTheSpotlight } from '@serenity-js/core';
import { LastResponse } from '@serenity-js/rest';

import { context } from '../../src/context';
import { CreateRoom, CreateStandardUser, LogInToRocketChat, PostMessage } from '../../src/screenplay/tasks/api';
import { administrator } from '../support/serenity.config';

Given('que {word} es administrador(a) de Rocket.Chat', async (name: string) => {
	await actorCalled(name).attemptsTo(LogInToRocketChat.asAdministrator());
});

Given('que {word} es un usuario estándar', async (name: string) => {
	const admin = await administrator();
	await admin.attemptsTo(CreateStandardUser.knownAs(name));
	const { username, password } = context.users[name];
	await actorCalled(name).attemptsTo(LogInToRocketChat.as(username, password));
});

Given('que existe una sala con el mensaje {string} publicado por {word}', async (text: string, author: string) => {
	const admin = await administrator();
	await admin.attemptsTo(CreateRoom.withEveryStandardUser());
	await actorCalled(author).attemptsTo(PostMessage.saying(text));
});

Given('que existe una sala con el mensaje {string} y el mensaje fijado {string} publicados por {word}', async (text: string, pinned: string, author: string) => {
	const admin = await administrator();
	await admin.attemptsTo(CreateRoom.withEveryStandardUser());
	await actorCalled(author).attemptsTo(PostMessage.saying(text), PostMessage.saying(pinned, { pinned: true }));
});

Then('la API responde con el código {int}', async (status: number) => {
	await actorInTheSpotlight().attemptsTo(Ensure.that(LastResponse.status(), equals(status)));
});

Then('el tipo de error es {string}', async (errorType: string) => {
	await actorInTheSpotlight().attemptsTo(Ensure.that(LastResponse.body<{ errorType: string }>().errorType, equals(errorType)));
});

Then('el mensaje de error contiene {string}', async (fragment: string) => {
	await actorInTheSpotlight().attemptsTo(Ensure.that(LastResponse.body<{ error: string }>().error, includes(fragment)));
});
