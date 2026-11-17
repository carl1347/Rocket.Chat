import { After, AfterAll, Before, BeforeAll, setDefaultTimeout } from '@cucumber/cucumber';
import { Cast, actorCalled, configure } from '@serenity-js/core';
import { CallAnApi } from '@serenity-js/rest';
import { BrowseTheWebWithPlaywright } from '@serenity-js/playwright';
import { chromium, type Browser } from 'playwright-core';

import { baseUrl } from '../../src/config';
import { context } from '../../src/context';
import { HoldRocketChatSession } from '../../src/screenplay/abilities/HoldRocketChatSession';
import { CleanUpTestData, LogInToRocketChat } from '../../src/screenplay/tasks/api';

setDefaultTimeout(60_000);

let browser: Browser;

BeforeAll(async () => {
	browser = await chromium.launch({ headless: !process.env.HEADED, executablePath: process.env.CHROMIUM_PATH || undefined });

	configure({
		actors: Cast.where((actor) =>
			actor.whoCan(
				CallAnApi.using({ baseURL: baseUrl, validateStatus: () => true }),
				HoldRocketChatSession.withoutSession(),
				BrowseTheWebWithPlaywright.using(browser),
			),
		),
		crew: [
			['@serenity-js/console-reporter', { theme: 'auto' }],
			['@serenity-js/serenity-bdd', { specDirectory: 'features' }],
			['@serenity-js/core:ArtifactArchiver', { outputDirectory: 'target/site/serenity' }],
		],
	});
});

AfterAll(async () => {
	await browser?.close();
});

Before(() => {
	context.reset();
});

/** The administrator behind the scenes: sets up and removes the data a scenario needs. */
export const administrator = async () => {
	const actor = actorCalled('Sistema');
	if (!context.adminReady) {
		await actor.attemptsTo(LogInToRocketChat.asAdministrator());
		context.adminReady = true;
	}
	return actor;
};

After(async () => {
	if (context.adminReady) {
		await actorCalled('Sistema').attemptsTo(CleanUpTestData());
	}
});
