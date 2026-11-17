import { Then, When } from '@cucumber/cucumber';
import { Ensure, not } from '@serenity-js/assertions';
import { Wait, actorCalled } from '@serenity-js/core';
import { Click, Hover, Key, Press, isVisible } from '@serenity-js/web';

import { context } from '../../src/context';
import { RocketChatApi } from '../../src/screenplay/interactions/RocketChatApi';
import { OpenTheRoom } from '../../src/screenplay/tasks/ui';
import * as Ui from '../../src/screenplay/ui/RocketChatUi';

const openTheMessageMenu = [Hover.over(Ui.LastMessage), Click.on(Ui.MoreActionsButton), Wait.until(Ui.OpenMenu, isVisible())] as const;
const openTheRoomMenu = [Click.on(Ui.RoomOptionsButton), Wait.until(Ui.OpenMenu, isVisible())] as const;

When('{word} abre la sala en la interfaz', async (name: string) => {
	await actorCalled(name).attemptsTo(OpenTheRoom());
});

Then('{word} puede borrar el último mensaje', async (name: string) => {
	await actorCalled(name).attemptsTo(...openTheMessageMenu, Ensure.that(Ui.menuItem('Delete'), isVisible()), Press.the(Key.Escape));
});

Then('{word} no puede borrar el último mensaje', async (name: string) => {
	await actorCalled(name).attemptsTo(...openTheMessageMenu, Ensure.that(Ui.menuItem('Delete'), not(isVisible())), Press.the(Key.Escape));
});

Then('{word} puede ver la opción de podar mensajes', async (name: string) => {
	await actorCalled(name).attemptsTo(...openTheRoomMenu, Ensure.that(Ui.menuItem('Prune messages'), isVisible()));
});

Then('{word} no ve la opción de podar mensajes', async (name: string) => {
	await actorCalled(name).attemptsTo(...openTheRoomMenu, Ensure.that(Ui.menuItem('Prune messages'), not(isVisible())));
});

When('{word} intenta limpiar el historial de la sala por la API', async (name: string) => {
	await actorCalled(name).attemptsTo(
		RocketChatApi.postLater('#actor tries to clean the history of the room', 'rooms.cleanHistory', () => ({
			roomId: context.currentRoom._id,
			latest: '9999-12-31T23:59:59.000Z',
			oldest: '0001-01-01T00:00:00.000Z',
		})),
	);
});
