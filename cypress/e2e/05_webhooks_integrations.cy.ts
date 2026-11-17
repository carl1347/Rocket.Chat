import { adminCredentials, apiPost, createChannel, deleteChannel, lastMessage, randomName, visitAs, type Credentials } from '../support/api';

describe('Webhooks and integrations', () => {
	let admin: Credentials;
	let room: { _id: string; name: string };
	let integration: { _id: string; token: string };

	const hookUrl = (id: string, token: string) => `/hooks/${id}/${token}`;

	before(() => {
		adminCredentials().then((creds) => {
			admin = creds;
			createChannel(admin).then((created) => {
				room = created;
				apiPost(admin, 'integrations.create', {
					type: 'webhook-incoming',
					name: randomName('cy-hook'),
					enabled: true,
					username: 'rocket.cat',
					channel: `#${room.name}`,
					scriptEnabled: false,
				}).then(({ body }) => {
					integration = { _id: body.integration._id, token: body.integration.token };
				});
			});
		});
	});

	after(() => {
		apiPost(admin, 'integrations.remove', { type: 'webhook-incoming', integrationId: integration._id }, false);
		deleteChannel(admin, room._id);
	});

	describe('success (API)', () => {
		it('accepts a JSON payload on /hooks/<id>/<token> with HTTP 200', () => {
			cy.request('POST', hookUrl(integration._id, integration.token), { text: 'Mensaje automatizado' }).then(({ status, body }) => {
				expect(status).to.eq(200);
				expect(body.success).to.eq(true);
			});
		});
	});

	describe('alternative (UI)', () => {
		it('shows the webhook message in the target room as posted by rocket.cat', () => {
			const text = `Mensaje automatizado ${Date.now()}`;
			cy.request('POST', hookUrl(integration._id, integration.token), { text });

			visitAs(admin, `/channel/${room.name}`);

			lastMessage().should('contain.text', text);
			lastMessage().should('contain.text', 'rocket.cat');
		});
	});

	describe('error (API)', () => {
		// authenticatedRoute throws for an unknown id/token, and the server answers with a plain 500 instead of a 404.
		it('rejects a corrupted token and publishes nothing', () => {
			const text = `must not be published ${Date.now()}`;

			cy.request({ method: 'POST', url: hookUrl(integration._id, `${integration.token}-corrupted`), body: { text }, failOnStatusCode: false }).then(
				({ status, body }) => {
					expect(status).to.eq(500);
					expect(body).to.eq('Internal Server Error');
				},
			);

			cy.request({
				url: '/api/v1/channels.messages',
				headers: { 'X-User-Id': admin.userId, 'X-Auth-Token': admin.authToken },
				qs: { roomId: room._id, count: 100 },
			}).then(({ body }) => {
				expect(body.messages.map((m: { msg: string }) => m.msg)).to.not.include(text);
			});
		});

		it('answers 404 when the url carries no token', () => {
			cy.request({ method: 'POST', url: `/hooks/${integration._id}`, body: { text: 'x' }, failOnStatusCode: false }).its('status').should('eq', 404);
		});

		it("answers 404 'integration-not-found' when removing an integration that is not registered", () => {
			cy.request({
				method: 'POST',
				url: `/hooks/remove/${integration._id}/${integration.token}`,
				body: { target_url: 'https://example.com/not-registered' },
				failOnStatusCode: false,
			}).then(({ status, body }) => {
				expect(status).to.eq(404);
				expect(body.success).to.eq(false);
				expect(body.error).to.eq('integration-not-found');
			});
		});
	});
});
