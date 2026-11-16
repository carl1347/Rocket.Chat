export type Credentials = { userId: string; authToken: string; username: string };

const apiPath = (endpoint: string) => `/api/v1/${endpoint}`;

const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const randomName = unique;

export const authHeaders = ({ userId, authToken }: Credentials) => ({ 'X-User-Id': userId, 'X-Auth-Token': authToken });

export const adminCredentials = (): Cypress.Chainable<Credentials> => login(Cypress.env('ADMIN_USER'), Cypress.env('ADMIN_PASS'));

export const login = (username: string, password: string): Cypress.Chainable<Credentials> =>
	cy.request('POST', apiPath('login'), { user: username, password }).then(({ body }) => ({
		userId: body.data.userId as string,
		authToken: body.data.authToken as string,
		username,
	}));

export const apiPost = <T = any>(creds: Credentials, endpoint: string, body: object, failOnStatusCode = true) =>
	cy.request<T>({ method: 'POST', url: apiPath(endpoint), headers: authHeaders(creds), body, failOnStatusCode });

export const apiGet = <T = any>(creds: Credentials, endpoint: string, qs: Record<string, unknown> = {}, failOnStatusCode = true) =>
	cy.request<T>({ method: 'GET', url: apiPath(endpoint), headers: authHeaders(creds), qs, failOnStatusCode });

export type TestUser = Credentials & { password: string; _id: string };

export const createUser = (admin: Credentials, prefix = 'cy-user'): Cypress.Chainable<TestUser> => {
	const username = unique(prefix);
	const password = `Pw-${unique('x')}!`;
	return apiPost(admin, 'users.create', {
		email: `${username}@example.com`,
		name: username,
		username,
		password,
		verified: true,
		joinDefaultChannels: false,
		requirePasswordChange: false,
		sendWelcomeEmail: false,
		roles: ['user'],
	}).then(({ body }) =>
		login(username, password).then((creds) => ({ ...creds, password, _id: body.user._id as string })),
	);
};

export const deleteUser = (admin: Credentials, userId: string) =>
	apiPost(admin, 'users.delete', { userId, confirmRelinquish: true }, false);

export const createChannel = (creds: Credentials, members: string[] = []) =>
	apiPost(creds, 'channels.create', { name: unique('cy-room'), members }).then(({ body }) => ({
		_id: body.channel._id as string,
		name: body.channel.name as string,
	}));

export const deleteChannel = (creds: Credentials, roomId: string) => apiPost(creds, 'channels.delete', { roomId }, false);

export const sendMessage = (creds: Credentials, message: { rid: string; msg: string; tmid?: string }) =>
	apiPost(creds, 'chat.sendMessage', { message }).then(({ body }) => body.message as { _id: string; rid: string; msg: string; tmid?: string });

export const setSetting = (admin: Credentials, id: string, value: unknown) => apiPost(admin, `settings/${id}`, { value });

export const getSettingValue = (admin: Credentials, id: string) =>
	apiGet(admin, `settings/${id}`).then(({ body }) => body.value as unknown);

/** Opens a page already authenticated as `creds`, using the session tokens Rocket.Chat keeps in localStorage. */
export const visitAs = (creds: Credentials, path: string) =>
	cy.visit(path, {
		onBeforeLoad(win) {
			win.localStorage.setItem('Meteor.userId', creds.userId);
			win.localStorage.setItem('Meteor.loginToken', creds.authToken);
		},
	});

export const lastMessage = () => cy.get('[role="listitem"][aria-roledescription="message"]').last();
