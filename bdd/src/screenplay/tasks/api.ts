import { Interaction, Task, type UsesAbilities } from '@serenity-js/core';
import { LastResponse } from '@serenity-js/rest';

import { adminPassword, adminUsername } from '../../config';
import { context } from '../../context';
import { HoldRocketChatSession } from '../abilities/HoldRocketChatSession';
import { RocketChatApi, send } from '../interactions/RocketChatApi';

const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const LogInToRocketChat = {
	as: (username: string, password: string) =>
		Task.where(
			`#actor logs in to Rocket.Chat as ${username}`,
			RocketChatApi.postWithoutSession('login', { user: username, password }),
			Interaction.where(`#actor keeps the session of ${username}`, async (actor) => {
				const body = await actor.answer(LastResponse.body<{ data: { userId: string; authToken: string } }>());
				HoldRocketChatSession.as(actor).start({ userId: body.data.userId, authToken: body.data.authToken, username });
			}),
		),
	asAdministrator: () => LogInToRocketChat.as(adminUsername, adminPassword),
};

export const CreateStandardUser = {
	knownAs: (label: string) =>
		Interaction.where(`#actor creates the standard user ${label}`, async (actor) => {
			const username = unique(`bdd-${label.toLowerCase()}`);
			const password = `Pw-${unique('x')}!`;
			const { data } = await send(actor, {
				method: 'POST',
				url: 'users.create',
				data: {
					email: `${username}@example.com`,
					name: username,
					username,
					password,
					verified: true,
					joinDefaultChannels: false,
					requirePasswordChange: false,
					sendWelcomeEmail: false,
					roles: ['user'],
				},
			});
			context.users[label] = { _id: data.user._id, username, password, userId: '', authToken: '' };
		}),
};

export const CreateRoom = {
	withEveryStandardUser: () =>
		Interaction.where('#actor creates a public room with every standard user', async (actor) => {
			const members = Object.values(context.users).map((user) => user.username);
			const { data } = await send(actor, { method: 'POST', url: 'channels.create', data: { name: unique('bdd-room'), members } });
			context.room = { _id: data.channel._id, name: data.channel.name };
		}),
};

export const PostMessage = {
	saying: (text: string, options: { tmid?: string; pinned?: boolean } = {}) =>
		Interaction.where(`#actor posts "${text}"`, async (actor) => {
			const { data } = await send(actor, {
				method: 'POST',
				url: 'chat.sendMessage',
				data: { message: { rid: context.currentRoom._id, msg: text, tmid: options.tmid } },
			});
			context.messageIds[text] = data.message._id;
			if (options.pinned) {
				await send(actor, { method: 'POST', url: 'chat.pinMessage', data: { messageId: data.message._id } });
			}
		}),
};

export const CreateIncomingWebhook = {
	postingAsRocketCat: () =>
		Interaction.where('#actor creates an incoming webhook that posts as rocket.cat in the room', async (actor) => {
			const { data } = await send(actor, {
				method: 'POST',
				url: 'integrations.create',
				data: {
					type: 'webhook-incoming',
					name: unique('bdd-hook'),
					enabled: true,
					username: 'rocket.cat',
					channel: `#${context.currentRoom.name}`,
					scriptEnabled: false,
				},
			});
			context.integration = { _id: data.integration._id, token: data.integration.token };
		}),
};

export const LimitDirectMessageMembersTo = (maxUsers: number) =>
	Interaction.where(`#actor limits direct messages to ${maxUsers} members`, async (actor) => {
		const { data } = await send(actor, { method: 'GET', url: 'settings/DirectMesssage_maxUsers' });
		context.maxUsersToRestore = data.value;
		await send(actor, { method: 'POST', url: 'settings/DirectMesssage_maxUsers', data: { value: maxUsers } });
	});

export const CleanUpTestData = () =>
	Interaction.where('#actor removes the data created by the scenario', async (actor: UsesAbilities) => {
		if (context.room) {
			await send(actor, { method: 'POST', url: 'channels.delete', data: { roomId: context.room._id } });
		}
		for (const user of Object.values(context.users)) {
			await send(actor, { method: 'POST', url: 'users.delete', data: { userId: user._id, confirmRelinquish: true } });
		}
		if (context.maxUsersToRestore !== undefined) {
			await send(actor, { method: 'POST', url: 'settings/DirectMesssage_maxUsers', data: { value: context.maxUsersToRestore } });
		}
	});
