import { Ensure, includes } from '@serenity-js/assertions';
import { Question, Task, Wait } from '@serenity-js/core';
import { Click, Enter, ExecuteScript, Hover, Key, Navigate, Page, Press, Text, isVisible } from '@serenity-js/web';

import { baseUrl } from '../../config';
import { context } from '../../context';
import { HoldRocketChatSession } from '../abilities/HoldRocketChatSession';
import * as Ui from '../ui/RocketChatUi';

const userId = Question.about('the user id of the session', (actor) => HoldRocketChatSession.as(actor).credentials.userId);
const authToken = Question.about('the token of the session', (actor) => HoldRocketChatSession.as(actor).credentials.authToken);
const roomUrl = Question.about('the url of the room', () => `${baseUrl}/channel/${context.currentRoom.name}`);

export const SignInToTheWebApp = () =>
	Task.where(
		'#actor signs in to the Rocket.Chat web app',
		Navigate.to(baseUrl),
		ExecuteScript.sync(
			`localStorage.setItem('Meteor.userId', arguments[0]); localStorage.setItem('Meteor.loginToken', arguments[1]);`,
		).withArguments(userId, authToken),
	);

export const OpenTheRoom = () =>
	Task.where('#actor opens the room', SignInToTheWebApp(), Navigate.to(roomUrl), Wait.until(Ui.LastMessage, isVisible()));

export const ReplyInThread = {
	toTheLastMessage: (reply: string) =>
		Task.where(
			`#actor replies "${reply}" in a thread`,
			Hover.over(Ui.LastMessage),
			Click.on(Ui.ReplyInThreadButton),
			Wait.until(Ui.ThreadComposerInput, isVisible()),
			Enter.theValue(reply).into(Ui.ThreadComposerInput),
			Press.the(Key.Enter),
			Wait.until(Text.of(Ui.ThreadMessageList), includes(reply)),
		),
};

export const StartDirectMessageWith = (label: string) =>
	Task.where(
		`#actor starts a direct message with ${label} from the sidebar`,
		SignInToTheWebApp(),
		Navigate.to(`${baseUrl}/home`),
		Click.on(Ui.CreateNewButton),
		Click.on(Ui.menuItem('Direct message')),
		Wait.until(Ui.NewDirectMessageDialog, isVisible()),
		Enter.theValue(Question.about(`the username of ${label}`, () => context.users[label].username)).into(Ui.DirectMessageUserInput),
		Click.on(Ui.FirstUserOption),
		Click.on(Ui.CreateDirectMessageButton),
	);

export const SendMessageInTheRoom = (text: string) =>
	Task.where(`#actor sends "${text}"`, Enter.theValue(text).into(Ui.RoomComposerInput), Press.the(Key.Enter));

export const PruneTheRoom = {
	keepingPinnedMessages: () =>
		Task.where(
			'#actor prunes the room keeping the pinned messages',
			Click.on(Ui.RoomOptionsButton),
			Click.on(Ui.menuItem('Prune messages')),
			Wait.until(Ui.PruneDialog, isVisible()),
			Enter.theValue('2000-01-01').into(Ui.NewerThanDate),
			Enter.theValue(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)).into(Ui.OlderThanDate),
			Click.on(Ui.DoNotPrunePinnedLabel),
			Click.on(Ui.PruneButton),
			Click.on(Ui.ConfirmPruneButton),
		),
};

export const CurrentPathname = () => Page.current().url().pathname;
export const TheLastMessageShows = (text: string) => Ensure.that(Text.of(Ui.LastMessage), includes(text));
