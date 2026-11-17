import { config } from './config.ts';

export type Session = { userId: string; authToken: string; username: string };
export type TestUser = Session & { _id: string; password: string };
export type Room = { _id: string; name: string };

type Options = { session?: Pick<Session, 'userId' | 'authToken'>; body?: unknown; query?: Record<string, string | number> };

export async function call<T = any>(method: 'GET' | 'POST', path: string, { session, body, query }: Options = {}) {
	const url = new URL(path.startsWith('/') ? path : `/api/v1/${path}`, config.baseUrl);
	Object.entries(query ?? {}).forEach(([key, value]) => url.searchParams.set(key, String(value)));
	const response = await fetch(url, {
		method,
		headers: {
			...(session ? { 'X-User-Id': session.userId, 'X-Auth-Token': session.authToken } : {}),
			...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const text = await response.text();
	let parsed: unknown = text;
	try {
		parsed = JSON.parse(text);
	} catch {
		// plain-text answers stay as text
	}
	return { status: response.status, body: parsed as T, text };
}

export const get = <T = any>(path: string, options?: Options) => call<T>('GET', path, options);
export const post = <T = any>(path: string, options?: Options) => call<T>('POST', path, options);

export async function login(username: string, password: string): Promise<Session> {
	const { status, body } = await post('login', { body: { user: username, password } });
	if (status !== 200) {
		throw new Error(`Could not log in as ${username}: HTTP ${status}. Check BASE_URL, ADMIN_USERNAME and ADMIN_PASS.`);
	}
	return { userId: body.data.userId, authToken: body.data.authToken, username };
}

export const uniqueName = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Creates what a test needs through the API, so the AI only drives the part under test. */
export class Fixture {
	admin!: Session;

	private readonly users: TestUser[] = [];

	private readonly rooms: { id: string; type: 'channels' | 'groups' }[] = [];

	static async create(): Promise<Fixture> {
		const fixture = new Fixture();
		fixture.admin = await login(config.adminUser, config.adminPass);
		return fixture;
	}

	async user(prefix = 'sh'): Promise<TestUser> {
		const username = uniqueName(prefix);
		const password = `Pw-${uniqueName('x')}!`;
		const { status, body } = await post('users.create', {
			session: this.admin,
			body: {
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
		if (status !== 200) {
			throw new Error(`users.create failed with HTTP ${status}: ${JSON.stringify(body)}`);
		}
		const user = { ...(await login(username, password)), _id: body.user._id as string, password };
		this.users.push(user);
		return user;
	}

	async channel(owner: Session = this.admin, members: string[] = []): Promise<Room> {
		const { body } = await post('channels.create', { session: owner, body: { name: uniqueName('sh-room'), members } });
		this.rooms.push({ id: body.channel._id, type: 'channels' });
		return { _id: body.channel._id, name: body.channel.name };
	}

	async message(session: Session, rid: string, msg: string, extra: Record<string, unknown> = {}) {
		const { status, body } = await post('chat.sendMessage', { session, body: { message: { rid, msg, ...extra } } });
		if (status !== 200) {
			throw new Error(`chat.sendMessage failed with HTTP ${status}: ${JSON.stringify(body)}`);
		}
		return body.message as { _id: string; msg: string };
	}

	async dispose(): Promise<void> {
		for (const room of this.rooms) {
			await post(`${room.type}.delete`, { session: this.admin, body: { roomId: room.id } });
		}
		for (const user of this.users) {
			await post('users.delete', { session: this.admin, body: { userId: user._id, confirmRelinquish: true } });
		}
	}
}

export async function roomTexts(session: Session, roomId: string): Promise<string[]> {
	const { body } = await get('channels.messages', { session, query: { roomId, count: 100 } });
	return (body.messages ?? []).map((message: { msg: string }) => message.msg);
}
