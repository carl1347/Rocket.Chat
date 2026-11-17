export const config = {
	baseUrl: (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
	adminUser: process.env.ADMIN_USERNAME ?? 'admin',
	adminPass: process.env.ADMIN_PASS ?? 'admin',
};

export type Session = { userId: string; authToken: string; username: string };
export type TestUser = Session & { _id: string; password: string };
export type Room = { _id: string; name: string };

export type ApiResponse<T = any> = { status: number; headers: Headers; body: T; text: string };

type Options = {
	session?: Pick<Session, 'userId' | 'authToken'>;
	body?: unknown;
	form?: Record<string, string>;
	query?: Record<string, string | number | boolean>;
	headers?: Record<string, string>;
};

const resolve = (path: string) => new URL(path.startsWith('/') ? path : `/api/v1/${path}`, config.baseUrl);

export const authHeaders = (session: Pick<Session, 'userId' | 'authToken'>) => ({ 'X-User-Id': session.userId, 'X-Auth-Token': session.authToken });

/** Performs one HTTP call and never throws on a non-2xx status: the tests assert on it. */
export async function call<T = any>(method: 'GET' | 'POST', path: string, options: Options = {}): Promise<ApiResponse<T>> {
	const url = resolve(path);
	for (const [key, value] of Object.entries(options.query ?? {})) {
		url.searchParams.set(key, String(value));
	}

	const headers: Record<string, string> = { ...(options.session ? authHeaders(options.session) : {}), ...options.headers };
	let body: string | undefined;
	if (options.form) {
		headers['Content-Type'] = 'application/x-www-form-urlencoded';
		body = new URLSearchParams(options.form).toString();
	} else if (options.body !== undefined) {
		headers['Content-Type'] ??= 'application/json';
		body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
	}

	const response = await fetch(url, { method, headers, body });
	const text = await response.text();
	let parsed: unknown = text;
	try {
		parsed = JSON.parse(text);
	} catch {
		// plain-text responses, such as the 500 of an unknown webhook token, are returned as text
	}
	return { status: response.status, headers: response.headers, body: parsed as T, text };
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

const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const uniqueName = unique;

/** Creates what a suite needs and removes it afterwards, restoring any setting it changed. */
export class Fixture {
	admin!: Session;

	private readonly users: TestUser[] = [];

	private readonly rooms: { id: string; type: 'channels' | 'groups' }[] = [];

	private readonly settings = new Map<string, unknown>();

	/** The server rate limiter would answer 429 to a regression run, so it is off unless a suite opts in. */
	static async create(options: { rateLimiter?: boolean } = {}): Promise<Fixture> {
		const fixture = new Fixture();
		fixture.admin = await login(config.adminUser, config.adminPass);
		await fixture.setting('API_Enable_Rate_Limiter', options.rateLimiter ?? false);
		return fixture;
	}

	async setting(id: string, value: unknown): Promise<void> {
		if (!this.settings.has(id)) {
			const current = await get(`settings/${id}`, { session: this.admin });
			this.settings.set(id, current.body.value);
		}
		await post(`settings/${id}`, { session: this.admin, body: { value } });
	}

	async user(prefix = 'reg'): Promise<TestUser> {
		const username = unique(prefix);
		const password = `Pw-${unique('x')}!`;
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
		const session = await login(username, password);
		const user = { ...session, _id: body.user._id as string, password };
		this.users.push(user);
		return user;
	}

	async channel(owner: Session = this.admin, members: string[] = []): Promise<Room> {
		const { body } = await post('channels.create', { session: owner, body: { name: unique('reg-room'), members } });
		this.rooms.push({ id: body.channel._id, type: 'channels' });
		return { _id: body.channel._id, name: body.channel.name };
	}

	async group(owner: Session = this.admin, members: string[] = []): Promise<Room> {
		const { body } = await post('groups.create', { session: owner, body: { name: unique('reg-group'), members } });
		this.rooms.push({ id: body.group._id, type: 'groups' });
		return { _id: body.group._id, name: body.group.name };
	}

	async message(session: Session, rid: string, msg: string, extra: Record<string, unknown> = {}) {
		const { status, body } = await post('chat.sendMessage', { session, body: { message: { rid, msg, ...extra } } });
		if (status !== 200) {
			throw new Error(`chat.sendMessage failed with HTTP ${status}: ${JSON.stringify(body)}`);
		}
		return body.message as { _id: string; rid: string; msg: string; tmid?: string };
	}

	async dispose(): Promise<void> {
		for (const room of this.rooms) {
			await post(`${room.type}.delete`, { session: this.admin, body: { roomId: room.id } });
		}
		for (const user of this.users) {
			await post('users.delete', { session: this.admin, body: { userId: user._id, confirmRelinquish: true } });
		}
		for (const [id, value] of this.settings) {
			await post(`settings/${id}`, { session: this.admin, body: { value } });
		}
	}
}

export const texts = (messages: { msg: string }[]) => messages.map((message) => message.msg);

export async function roomTexts(session: Session, roomId: string): Promise<string[]> {
	const { body } = await get('channels.messages', { session, query: { roomId, count: 100 } });
	return texts(body.messages ?? []);
}
