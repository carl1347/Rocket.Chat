import { Then, When } from '@cucumber/cucumber';
import { Ensure, contain, equals, includes } from '@serenity-js/assertions';
import { actorCalled, actorInTheSpotlight } from '@serenity-js/core';
import { Text } from '@serenity-js/web';

import { context } from '../../src/context';
import { RocketChatApi } from '../../src/screenplay/interactions/RocketChatApi';
import { ReplyCountOfTheMessage, TextsInTheThreadOf } from '../../src/screenplay/questions';
import { OpenTheRoom, ReplyInThread } from '../../src/screenplay/tasks/ui';
import * as Ui from '../../src/screenplay/ui/RocketChatUi';

const PARENT = 'Mensaje padre del hilo';

const sendMessageWith = (description: string, message: () => object) =>
	RocketChatApi.postLater(description, 'chat.sendMessage', () => ({ message: { rid: context.currentRoom._id, ...message() } }));

When('{word} responde {string} en el hilo del último mensaje', async (name: string, reply: string) => {
	await actorCalled(name).attemptsTo(OpenTheRoom(), ReplyInThread.toTheLastMessage(reply));
});

Then('el panel de hilos muestra {string}', async (reply: string) => {
	await actorInTheSpotlight().attemptsTo(Ensure.that(Text.of(Ui.ThreadMessageList), includes(reply)));
});

Then('el mensaje {string} registra {int} respuesta', async (text: string, count: number) => {
	await actorInTheSpotlight().attemptsTo(Ensure.that(ReplyCountOfTheMessage(text), equals(count)));
});

When('{word} envía por la API {string} como respuesta de {string}', async (name: string, reply: string, parent: string) => {
	await actorCalled(name).attemptsTo(sendMessageWith(`#actor replies "${reply}" in the thread of "${parent}"`, () => ({ msg: reply, tmid: context.messageIds[parent] })));
});

Then('el hilo de {string} contiene {string}', async (parent: string, reply: string) => {
	await actorInTheSpotlight().attemptsTo(Ensure.that(TextsInTheThreadOf(parent), contain(reply)));
});

When('{word} envía por la API un mensaje con un tmid numérico', async (name: string) => {
	await actorCalled(name).attemptsTo(sendMessageWith('#actor sends a message whose tmid is a number', () => ({ msg: 'tmid numérico', tmid: 12345 })));
});

When('{word} envía por la API un mensaje con un tmid que no corresponde a ningún mensaje', async (name: string) => {
	await actorCalled(name).attemptsTo(sendMessageWith('#actor replies to a message that does not exist', () => ({ msg: 'respuesta huérfana', tmid: `no-existe-${PARENT.length}` })));
});
