import { Ability, LogicError } from '@serenity-js/core';

import type { Credentials } from '../../context';

/** Lets an actor remember who it is logged in as on the Rocket.Chat server. */
export class HoldRocketChatSession extends Ability {
	private current?: Credentials;

	static withoutSession(): HoldRocketChatSession {
		return new HoldRocketChatSession();
	}

	start(credentials: Credentials): void {
		this.current = credentials;
	}

	get credentials(): Credentials {
		if (!this.current) {
			throw new LogicError('The actor has not logged in to Rocket.Chat yet');
		}
		return this.current;
	}

	get headers(): Record<string, string> {
		return { 'X-User-Id': this.credentials.userId, 'X-Auth-Token': this.credentials.authToken };
	}
}
