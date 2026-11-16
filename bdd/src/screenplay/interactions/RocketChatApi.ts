import { Interaction, type UsesAbilities } from '@serenity-js/core';
import { CallAnApi } from '@serenity-js/rest';
import type { AxiosResponse } from 'axios';

import { HoldRocketChatSession } from '../abilities/HoldRocketChatSession';

type Method = 'GET' | 'POST';

export type ApiCall = { method: Method; url: string; data?: object; params?: object; authenticated?: boolean };

const toUrl = (endpoint: string) => (endpoint.startsWith('/') ? endpoint : `/api/v1/${endpoint}`);

/** Performs the call as `actor`; the response also becomes `LastResponse` for the actor. */
export const send = (actor: UsesAbilities, { method, url, data, params, authenticated = true }: ApiCall): Promise<AxiosResponse> =>
	CallAnApi.as(actor).request({
		method,
		url: toUrl(url),
		data,
		params,
		headers: authenticated ? HoldRocketChatSession.as(actor).headers : {},
	});

const call = (description: string, request: ApiCall) => Interaction.where(description, async (actor) => void (await send(actor, request)));

const callLater = (description: string, build: () => ApiCall) => Interaction.where(description, async (actor) => void (await send(actor, build())));

export const RocketChatApi = {
	/** For requests whose body depends on what earlier steps of the scenario created. */
	postLater: (description: string, endpoint: string | (() => string), build: () => object, authenticated = true) =>
		callLater(description, () => ({ method: 'POST', url: typeof endpoint === 'function' ? endpoint() : endpoint, data: build(), authenticated })),

	post: (endpoint: string, data: object) => call(`#actor posts to ${endpoint}`, { method: 'POST', url: endpoint, data }),
	get: (endpoint: string, params: object = {}) => call(`#actor gets ${endpoint}`, { method: 'GET', url: endpoint, params }),
	postWithoutSession: (url: string, data: object) =>
		call(`#actor posts to ${url} without a session`, { method: 'POST', url, data, authenticated: false }),
};
