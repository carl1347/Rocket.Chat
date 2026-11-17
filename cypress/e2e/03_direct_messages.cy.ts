import {
	adminCredentials,
	apiGet,
	apiPost,
	createUser,
	deleteUser,
	getSettingValue,
	lastMessage,
	setSetting,
	visitAs,
	type Credentials,
	type TestUser,
} from '../support/api';

describe('Direct messages', () => {
	let admin: Credentials;
	let alice: TestUser;
	let bob: TestUser;
	let carol: TestUser;
	let originalMaxUsers: unknown;

	before(() => {
		adminCredentials().then((creds) => {
			admin = creds;
			createUser(admin, 'cy-dm-a').then((user) => (alice = user));
			createUser(admin, 'cy-dm-b').then((user) => (bob = user));
			createUser(admin, 'cy-dm-c').then((user) => (carol = user));
			getSettingValue(admin, 'DirectMesssage_maxUsers').then((value) => (originalMaxUsers = value));
		});
	});

	after(() => {
		setSetting(admin, 'DirectMesssage_maxUsers', originalMaxUsers);
		[alice, bob, carol].forEach((user) => deleteUser(admin, user._id));
	});

	describe('success (UI)', () => {
		it('starts a DM from the sidebar, lands on /direct/<id> and sends a message', () => {
			const text = 'hello from the UI';

			visitAs(alice, '/home');
			cy.findByRole('button', { name: 'Create new' }).click();
			cy.findByRole('menuitem', { name: 'Direct message' }).click();

			cy.findByRole('dialog', { name: 'New direct message' }).within(() => {
				cy.findByRole('combobox', { name: 'Select one or more people to message' }).type(bob.username);
				cy.findByRole('option', { name: new RegExp(bob.username) }).click();
				cy.findByRole('button', { name: 'Create' }).click();
			});

			cy.location('pathname').should('match', /^\/direct\/[A-Za-z0-9]+$/);

			cy.get('footer[aria-label="Room composer"] [name="msg"]').type(`${text}{enter}`);
			lastMessage().should('contain.text', text);
		});
	});

	describe('alternative (API)', () => {
		it('is idempotent: asking again for the same pair returns the existing room', () => {
			apiPost(alice, 'im.create', { username: bob.username }).then(({ body: first }) => {
				apiPost(alice, 'im.create', { username: bob.username }).then(({ body: second }) => {
					expect(second.room.rid).to.eq(first.room.rid);
				});

				apiGet(alice, 'im.list').then(({ body }) => {
					const withBob = body.ims.filter((room: { usernames: string[] }) => room.usernames.includes(bob.username));
					expect(withBob).to.have.length(1);
					expect(withBob[0]._id).to.eq(first.room.rid);
				});
			});
		});
	});

	describe('error (API)', () => {
		it('rejects a username that does not exist with HTTP 400', () => {
			apiPost(alice, 'im.create', { username: 'cy-missing-user-xyz' }, false).then(({ status, body }) => {
				expect(status).to.eq(400);
				expect(body.success).to.eq(false);
				expect(body.errorType).to.eq('error-invalid-user');
			});
		});

		it('rejects a DM that exceeds DirectMesssage_maxUsers', () => {
			// the creator counts as one member, so 2 as the limit rejects creator + 2 others
			setSetting(admin, 'DirectMesssage_maxUsers', 2);

			apiPost(alice, 'im.create', { usernames: `${bob.username},${carol.username}` }, false).then(({ status, body }) => {
				expect(status).to.eq(400);
				expect(body.success).to.eq(false);
				expect(body.errorType).to.eq('error-direct-message-max-user-exceeded');
			});
		});
	});
});
