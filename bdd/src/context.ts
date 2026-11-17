export type Credentials = { userId: string; authToken: string; username: string };
export type KnownUser = Credentials & { _id: string; password: string };
export type Room = { _id: string; name: string };

/** Data that the steps of one scenario share. Reset before every scenario. */
class ScenarioContext {
	room?: Room;
	messageIds: Record<string, string> = {};
	users: Record<string, KnownUser> = {};
	integration?: { _id: string; token: string };
	lastRoomId?: string;
	lastRoomIds: string[] = [];
	maxUsersToRestore?: unknown;
	adminReady = false;

	reset(): void {
		this.room = undefined;
		this.messageIds = {};
		this.users = {};
		this.integration = undefined;
		this.lastRoomId = undefined;
		this.lastRoomIds = [];
		this.maxUsersToRestore = undefined;
		this.adminReady = false;
	}

	get currentRoom(): Room {
		if (!this.room) {
			throw new Error('The scenario has no room yet');
		}
		return this.room;
	}
}

export const context = new ScenarioContext();
