import {
	adminCredentials,
	apiPost,
	createChannel,
	createUser,
	deleteChannel,
	deleteUser,
	lastMessage,
	sendMessage,
	visitAs,
	type Credentials,
	type TestUser,
} from '../support/api';

describe('RBAC permissions', () => {
	let admin: Credentials;
	let standardUser: TestUser;
	let room: { _id: string; name: string };

	before(() => {
		adminCredentials().then((creds) => {
			admin = creds;
			createUser(admin, 'cy-rbac').then((user) => {
				standardUser = user;
				createChannel(admin, [user.username]).then((created) => {
					room = created;
					sendMessage(admin, { rid: room._id, msg: 'message written by the owner' });
				});
			});
		});
	});

	after(() => {
		deleteChannel(admin, room._id);
		deleteUser(admin, standardUser._id);
	});

	describe('success (UI)', () => {
		it('lets an admin delete messages and open the prune panel', () => {
			visitAs(admin, `/channel/${room.name}`);

			lastMessage().should('contain.text', 'message written by the owner').trigger('mouseover');
			lastMessage().findByRole('button', { name: 'More' }).click();
			cy.findByRole('menu', { name: 'More' }).findByRole('menuitem', { name: 'Delete' }).should('be.visible');
			cy.get('body').type('{esc}');

			cy.findByRole('toolbar', { name: 'Primary room actions' }).findByRole('button', { name: 'Options' }).click();
			cy.findByRole('menuitem', { name: 'Prune messages' }).should('be.visible');
		});
	});

	describe('alternative (UI)', () => {
		it("does not show delete or prune to a standard user on somebody else's message", () => {
			visitAs(standardUser, `/channel/${room.name}`);

			lastMessage().should('contain.text', 'message written by the owner').trigger('mouseover');
			lastMessage().findByRole('button', { name: 'More' }).click();
			cy.findByRole('menu', { name: 'More' }).within(() => {
				cy.findByRole('menuitem', { name: 'Delete' }).should('not.exist');
			});
			cy.get('body').type('{esc}');

			cy.findByRole('toolbar', { name: 'Primary room actions' }).findByRole('button', { name: 'Options' }).click();
			cy.findByRole('menuitem', { name: 'Prune messages' }).should('not.exist');
		});
	});

	describe('error (API)', () => {
		it('answers 403 Forbidden when a standard user calls rooms.cleanHistory', () => {
			apiPost(
				standardUser,
				'rooms.cleanHistory',
				{ roomId: room._id, latest: '9999-12-31T23:59:59.000Z', oldest: '0001-01-01T00:00:00.000Z' },
				false,
			).then(({ status, body }) => {
				expect(status).to.eq(403);
				expect(body.success).to.eq(false);
				expect(body.errorType).to.eq('error-forbidden');
			});
		});
	});
});
