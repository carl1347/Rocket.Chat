import { Stagehand, localBrowser } from '@browserbasehq/stagehand';
import type { Page, StagehandBrowser } from '@browserbasehq/stagehand';
import { z } from 'zod/v4';

import type { Session } from './api.ts';
import { config } from './config.ts';
import { ollamaClientLLM } from './ollama.ts';

/** One browser plus a Stagehand instance whose model is the local Ollama server. */
export class Harness {
	private constructor(
		readonly stagehand: Stagehand,
		private readonly browser: StagehandBrowser,
	) {}

	static async start(): Promise<Harness> {
		const browser = await localBrowser.launch({ headless: !config.headed, executablePath: config.chromePath });
		const stagehand = await Stagehand.create({
			browser,
			model: ollamaClientLLM({ baseUrl: config.ollamaUrl, model: config.ollamaModel, numCtx: config.ollamaNumCtx }),
			logging: { level: 'warn', format: 'pretty' },
		});
		return new Harness(stagehand, browser);
	}

	async page(): Promise<Page> {
		const [page] = await this.browser.context.pages();
		return page ?? this.browser.context.newPage();
	}

	/** Signs in with the tokens Rocket.Chat keeps in localStorage, so no model call is spent on the login form. */
	async openAs(session: Session, path: string): Promise<Page> {
		await this.browser.context.addInitScript(
			({ userId, authToken }: { userId: string; authToken: string }) => {
				localStorage.setItem('Meteor.userId', userId);
				localStorage.setItem('Meteor.loginToken', authToken);
			},
			{ userId: session.userId, authToken: session.authToken },
		);
		const page = await this.page();
		await page.goto(`${config.baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
		return page;
	}

	/** Asks the model to read the screen as a yes/no question. Use for navigation hints, not as the only verdict. */
	async asks(question: string): Promise<boolean> {
		const { data } = await this.stagehand.extract(question, z.object({ answer: z.boolean() }));
		return data.answer;
	}

	async stop(): Promise<void> {
		await this.stagehand.close();
		await this.browser.close();
	}
}

/** Reads from the DOM directly: the verdict of a test never rests on the model alone. */
export const domHas = (page: Page, selector: string): Promise<boolean> =>
	page.evaluate((css: string) => document.querySelector(css) !== null, selector);

export const domText = (page: Page, selector: string): Promise<string> =>
	page.evaluate((css: string) => document.querySelector(css)?.textContent ?? '', selector);

export const menuHas = (page: Page, label: string): Promise<boolean> =>
	page.evaluate(
		(text: string) => [...document.querySelectorAll('[role="menuitem"]')].some((item) => item.textContent?.trim() === text),
		label,
	);

/** Polls until `check` passes: the UI and the server settle a moment after the AI acts. */
export async function eventually<T>(check: () => Promise<T>, accept: (value: T) => boolean, timeoutMs = 20_000): Promise<T> {
	const deadline = Date.now() + timeoutMs;
	let value = await check();
	while (!accept(value) && Date.now() < deadline) {
		await new Promise((resolve) => setTimeout(resolve, 500));
		value = await check();
	}
	return value;
}
