import {
	adminCredentials,
	apiGet,
	apiPost,
	createChannel,
	deleteChannel,
	sendMessage,
	visitAs,
	type Credentials,
} from '../support/api';

const EVERYTHING = { latest: '9999-12-31T23:59:59.000Z', oldest: '0001-01-01T00:00:00.000Z' };

const messageTexts = (admin: Credentials, roomId: string) =>
	apiGet(admin, 'channels.messages', { roomId, count: 100 }).then(({ body }) => body.messages.map((m: { msg: string }) => m.msg) as string[]);

describe('Data retention (prune)', () => {
	let admin: Credentials;
	let room: { _id: string; name: string };

	const seedRoom = () =>
		createChannel(admin).then((created) => {
			room = created;
			sendMessage(admin, { rid: room._id, msg: 'regular message' });
			sendMessage(admin, { rid: room._id, msg: 'pinned message' }).then(({ _id }) => apiPost(admin, 'chat.pinMessage', { messageId: _id }));
		});

	before(() => {
		adminCredentials().then((creds) => (admin = creds));
	});

	beforeEach(() => {
		seedRoom();
	});

	afterEach(() => {
		deleteChannel(admin, room._id);
	});

	describe('success (UI)', () => {
		it('prunes a date range from the room menu while keeping pinned messages', () => {
			const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

			visitAs(admin, `/channel/${room.name}`);
			cy.findByRole('toolbar', { name: 'Primary room actions' }).findByRole('button', { name: 'Options' }).click();
			cy.findByRole('menuitem', { name: 'Prune messages' }).click();

			cy.findByRole('dialog', { name: 'Prune messages' }).within(() => {
				cy.get('input[aria-label="Newer than Date"]').type('2000-01-01');
				cy.get('input[aria-label="Older than Date"]').type(tomorrow);
				cy.contains('label', 'Do not prune pinned messages').click();
				cy.contains('label', 'Do not prune pinned messages').find('input[type="checkbox"]').should('be.checked');
				cy.findByRole('button', { name: 'Prune' }).click();
			});
			cy.findByRole('button', { name: 'Yes, prune them!' }).click();

			cy.get('[role="listitem"][aria-roledescription="message"]').should('contain.text', 'pinned message');
			cy.get('[role="listitem"][aria-roledescription="message"]').should('not.contain.text', 'regular message');
			messageTexts(admin, room._id).then((texts) => {
				expect(texts).to.include('pinned message');
				expect(texts).to.not.include('regular message');
			});
		});
	});

	describe('alternative (API)', () => {
		it('keeps pinned messages intact when excludePinned is true', () => {
			apiPost(admin, 'rooms.cleanHistory', { roomId: room._id, ...EVERYTHING, excludePinned: true }).then(({ status, body }) => {
				expect(status).to.eq(200);
				expect(body.success).to.eq(true);
			});

			messageTexts(admin, room._id).then((texts) => {
				expect(texts).to.include('pinned message');
				expect(texts).to.not.include('regular message');
			});
		});

		it('prunes pinned messages too when excludePinned is false', () => {
			apiPost(admin, 'rooms.cleanHistory', { roomId: room._id, ...EVERYTHING, excludePinned: false });

			messageTexts(admin, room._id).then((texts) => {
				expect(texts).to.not.include('pinned message');
			});
		});
	});

	describe('error (API)', () => {
		it('rejects a request without the required date range with HTTP 400', () => {
			apiPost(admin, 'rooms.cleanHistory', { roomId: room._id, latest: EVERYTHING.latest }, false).then(({ status, body }) => {
				expect(status).to.eq(400);
				expect(body.success).to.eq(false);
			});
		});

		// The server does not compare the two dates: an inverted range simply matches nothing.
		// Change both expectations if the server starts rejecting it with HTTP 400.
		it('currently treats an inverted range (latest < oldest) as an empty selection', () => {
			apiPost(admin, 'rooms.cleanHistory', { roomId: room._id, latest: '2001-01-01T00:00:00.000Z', oldest: '2030-01-01T00:00:00.000Z' }).then(
				({ status, body }) => {
					expect(status).to.eq(200);
					expect(body.count).to.eq(0);
				},
			);

			messageTexts(admin, room._id).then((texts) => {
				expect(texts).to.include.members(['regular message', 'pinned message']);
			});
		});
	});
});
