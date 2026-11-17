import {
	adminCredentials,
	apiGet,
	apiPost,
	createChannel,
	deleteChannel,
	lastMessage,
	sendMessage,
	visitAs,
	type Credentials,
} from '../support/api';

describe('Threads', () => {
	let admin: Credentials;
	let room: { _id: string; name: string };
	let parent: { _id: string };

	before(() => {
		adminCredentials().then((creds) => {
			admin = creds;
			createChannel(admin).then((created) => {
				room = created;
				sendMessage(admin, { rid: room._id, msg: 'parent message for threads' }).then((message) => {
					parent = message;
				});
			});
		});
	});

	after(() => {
		deleteChannel(admin, room._id);
	});

	describe('success (UI)', () => {
		it('replies in a thread and shows it in the thread panel with the counter updated', () => {
			const reply = 'reply sent from the UI';

			visitAs(admin, `/channel/${room.name}`);
			lastMessage().should('contain.text', 'parent message for threads');
			lastMessage().trigger('mouseover');
			lastMessage().findByRole('button', { name: 'Reply in thread' }).click();

			cy.get('footer[aria-label="Thread composer"] [name="msg"]').type(`${reply}{enter}`);

			cy.findByRole('list', { name: 'Thread message list' }).should('contain.text', reply);
			lastMessage().find('[role="link"][aria-roledescription="thread message preview"]').should('exist');

			apiGet(admin, 'chat.getMessage', { msgId: parent._id }).then(({ body }) => {
				expect(body.message.tcount).to.eq(1);
			});
		});
	});

	describe('alternative (API)', () => {
		it('accepts chat.sendMessage with a valid tmid and links the reply to the parent', () => {
			apiPost(admin, 'chat.sendMessage', { message: { rid: room._id, msg: 'reply sent from the API', tmid: parent._id } }).then(
				({ status, body }) => {
					expect(status).to.eq(200);
					expect(body.success).to.eq(true);
					expect(body.message.tmid).to.eq(parent._id);
					expect(body.message.rid).to.eq(room._id);
				},
			);

			apiGet(admin, 'chat.getThreadMessages', { tmid: parent._id }).then(({ body }) => {
				expect(body.messages.map((m: { msg: string }) => m.msg)).to.include('reply sent from the API');
			});
		});
	});

	describe('error (API)', () => {
		it('rejects a tmid that is not a string with HTTP 400', () => {
			apiPost(admin, 'chat.sendMessage', { message: { rid: room._id, msg: 'bad tmid type', tmid: 12345 } }, false).then(
				({ status, body }) => {
					expect(status).to.eq(400);
					expect(body.success).to.eq(false);
				},
			);
		});

		it('rejects tshow without tmid with HTTP 400', () => {
			apiPost(admin, 'chat.sendMessage', { message: { rid: room._id, msg: 'tshow only', tshow: true } }, false).then(
				({ status, body }) => {
					expect(status).to.eq(400);
					expect(body.success).to.eq(false);
				},
			);
		});

		// The server does not look the parent up to reject it: a tmid that points nowhere is stored as-is (HTTP 200).
		// Flip the expectation to 400 if the server starts validating it.
		it('currently accepts a well-formed tmid that matches no message', () => {
			apiPost(admin, 'chat.sendMessage', { message: { rid: room._id, msg: 'orphan reply', tmid: 'does-not-exist' } }, false).then(
				({ status }) => {
					expect(status).to.eq(200);
				},
			);
		});
	});
});
