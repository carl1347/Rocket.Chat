import { Question } from '@serenity-js/core';

import { context } from '../../context';
import { send } from '../interactions/RocketChatApi';

export const TextsOfTheMessagesInTheRoom = () =>
	Question.about<Promise<string[]>>('the texts of the messages in the room', async (actor) => {
		const { data } = await send(actor, { method: 'GET', url: 'channels.messages', params: { roomId: context.currentRoom._id, count: 100 } });
		return data.messages.map((message: { msg: string }) => message.msg);
	});

export const ReplyCountOfTheMessage = (text: string) =>
	Question.about<Promise<number>>(`the reply count of "${text}"`, async (actor) => {
		const { data } = await send(actor, { method: 'GET', url: 'chat.getMessage', params: { msgId: context.messageIds[text] } });
		return data.message.tcount ?? 0;
	});

export const TextsInTheThreadOf = (text: string) =>
	Question.about<Promise<string[]>>(`the texts in the thread of "${text}"`, async (actor) => {
		const { data } = await send(actor, { method: 'GET', url: 'chat.getThreadMessages', params: { tmid: context.messageIds[text] } });
		return data.messages.map((message: { msg: string }) => message.msg);
	});

export const DirectRoomIdsWith = (label: string) =>
	Question.about<Promise<string[]>>(`the direct rooms shared with ${label}`, async (actor) => {
		const { data } = await send(actor, { method: 'GET', url: 'im.list' });
		return data.ims.filter((room: { usernames: string[] }) => room.usernames.includes(context.users[label].username)).map((room: { _id: string }) => room._id);
	});
