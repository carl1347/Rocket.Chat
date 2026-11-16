import { Given, Then, When } from '@cucumber/cucumber';
import { Ensure, contain, equals, includes, not } from '@serenity-js/assertions';
import { Wait, actorCalled, actorInTheSpotlight } from '@serenity-js/core';
import { LastResponse } from '@serenity-js/rest';
import { Text } from '@serenity-js/web';

import { context } from '../../src/context';
import { RocketChatApi } from '../../src/screenplay/interactions/RocketChatApi';
import { TextsOfTheMessagesInTheRoom } from '../../src/screenplay/questions';
import { CreateIncomingWebhook } from '../../src/screenplay/tasks/api';
import { OpenTheRoom } from '../../src/screenplay/tasks/ui';
import * as Ui from '../../src/screenplay/ui/RocketChatUi';
import { administrator } from '../support/serenity.config';

const hook = () => {
	if (!context.integration) {
		throw new Error('The scenario has no incoming webhook');
	}
	return context.integration;
};

const hookUrl = (token: string = hook().token) => `/hooks/${hook()._id}/${token}`;

const postToWebhook = (description: string, url: () => string, body: object) => RocketChatApi.postLater(description, url, () => body, false);

Given('que existe un webhook entrante que publica como rocket.cat en la sala', async () => {
	const admin = await administrator();
	await admin.attemptsTo(CreateIncomingWebhook.postingAsRocketCat());
});

When('{word} envía el mensaje {string} al webhook', async (name: string, text: string) => {
	await actorCalled(name).attemptsTo(postToWebhook('#actor sends a message to the webhook', () => hookUrl(), { text }));
});

When('{word} envía el mensaje {string} al webhook con el token alterado', async (name: string, text: string) => {
	await actorCalled(name).attemptsTo(postToWebhook('#actor sends a message with a corrupted token', () => hookUrl(`${hook().token}-alterado`), { text }));
});

When('{word} llama al webhook sin token', async (name: string) => {
	await actorCalled(name).attemptsTo(postToWebhook('#actor calls the webhook without a token', () => `/hooks/${hook()._id}`, { text: 'sin token' }));
});

When('{word} solicita eliminar la integración de la URL {string}', async (name: string, targetUrl: string) => {
	await actorCalled(name).attemptsTo(
		postToWebhook('#actor asks to remove an integration that is not registered', () => `/hooks/remove/${hook()._id}/${hook().token}`, { target_url: targetUrl }),
	);
});

Then('la API informa éxito', async () => {
	await actorInTheSpotlight().attemptsTo(Ensure.that(LastResponse.body<{ success: boolean }>().success, equals(true)));
});

Then('{word} ve en la sala el mensaje {string} publicado por {string}', async (name: string, text: string, author: string) => {
	await actorCalled(name).attemptsTo(
		OpenTheRoom(),
		Wait.until(Text.of(Ui.LastMessage), includes(text)),
		Ensure.that(Text.of(Ui.LastMessage), includes(author)),
	);
});

Then('{word} comprueba que la sala no contiene {string}', async (name: string, text: string) => {
	await actorCalled(name).attemptsTo(Ensure.that(TextsOfTheMessagesInTheRoom(), not(contain(text))));
});
