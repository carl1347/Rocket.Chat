import { before, beforeEach, describe, it } from 'node:test';

import { mockModel } from '@rocket.chat/models/testing';
import { expect } from 'chai';
import p from 'proxyquire';
import sinon from 'sinon';

import { createFakeMessage, createFakeRoom } from '../../../tests/mocks/data';

const modelsMock = { Messages: { findOneById: sinon.stub() } };
const getMentionsMock = sinon.stub();
const replyMock = sinon.stub();
const callbacksRunAsyncMock = sinon.stub();
const updateThreadUsersSubscriptionsMock = sinon.stub();
const sendMessageNotificationsMock = sinon.stub();
const notifyOnMessageChangeMock = sinon.stub();

const { processThreads } = p.noCallThru().load('./processThreads.ts', {
	'./notifyUsersOnMessage': { updateThreadUsersSubscriptions: updateThreadUsersSubscriptionsMock, getMentions: getMentionsMock },
	'./sendNotificationsOnMessage': { sendMessageNotifications: sendMessageNotificationsMock },
	'../../lib/callbacks': {
		callbacks: { runAsync: callbacksRunAsyncMock, add: sinon.stub(), remove: sinon.stub(), priority: { LOW: 'low' } },
	},
	'../../lib/messaging/threads/functions': { reply: replyMock },
	'../../lib/notifyListener': { notifyOnMessageChange: notifyOnMessageChangeMock },
	'../../settings': { settings: { watch: sinon.stub() } },
});

describe('processThreads', () => {
	const room = createFakeRoom();
	const parentMessage = createFakeMessage({ rid: room._id, tcount: 1, replies: [] });
	const author = { _id: 'authorId', username: 'author' };

	const threadReply = (overrides: Record<string, unknown> = {}) =>
		createFakeMessage({ rid: room._id, tmid: parentMessage._id, u: author, ...overrides });

	before(() => {
		mockModel('Messages', modelsMock.Messages);
	});

	beforeEach(() => {
		callbacksRunAsyncMock.reset();
		replyMock.reset();
		updateThreadUsersSubscriptionsMock.reset();
		sendMessageNotificationsMock.reset();
		notifyOnMessageChangeMock.reset();
		modelsMock.Messages.findOneById.reset();
		modelsMock.Messages.findOneById.resolves(parentMessage);
		getMentionsMock.reset();
		getMentionsMock.resolves({ mentionIds: [] });
	});

	const expectNoThreadSideEffects = () => {
		expect(replyMock.called).to.be.false;
		expect(updateThreadUsersSubscriptionsMock.called).to.be.false;
		expect(sendMessageNotificationsMock.called).to.be.false;
		expect(notifyOnMessageChangeMock.called).to.be.false;
		expect(callbacksRunAsyncMock.called).to.be.false;
	};

	describe('when there is no thread to update', () => {
		it('should return the message untouched and skip the parent lookup when it has no tmid', async () => {
			// Arrange
			const message = createFakeMessage({ rid: room._id, u: author });
			const snapshot = structuredClone(message);

			// Act
			const result = await processThreads(message, room);

			// Assert
			expect(result).to.equal(message);
			expect(result).to.deep.equal(snapshot);
			expect(modelsMock.Messages.findOneById.called).to.be.false;
			expectNoThreadSideEffects();
		});

		it('should return the message untouched and leave the thread counters alone when the parent does not exist', async () => {
			// Arrange
			const message = threadReply({ tmid: 'missing-parent' });
			const snapshot = structuredClone(message);
			modelsMock.Messages.findOneById.resolves(null);

			// Act
			const result = await processThreads(message, room);

			// Assert
			expect(modelsMock.Messages.findOneById.calledOnceWithExactly('missing-parent')).to.be.true;
			expect(result).to.equal(message);
			expect(result).to.deep.equal(snapshot);
			expect(result).to.not.have.property('tcount');
			expectNoThreadSideEffects();
		});
	});

	it('should mark the thread as read for the author of the reply', async () => {
		await processThreads(threadReply(), room);

		expect(callbacksRunAsyncMock.calledWith('afterReadMessages', room, { uid: author._id, tmid: parentMessage._id })).to.be.true;
	});

	it('should mark the thread as read only after the thread metadata is updated', async () => {
		await processThreads(threadReply(), room);

		expect(replyMock.calledBefore(callbacksRunAsyncMock)).to.be.true;
	});

	it('should not mark anything as read when the message is not a thread reply', async () => {
		await processThreads(createFakeMessage({ rid: room._id, u: author }), room);

		expect(callbacksRunAsyncMock.called).to.be.false;
	});

	it('should not mark anything as read when the message was edited', async () => {
		await processThreads(threadReply({ editedAt: new Date(), editedBy: author }), room);

		expect(callbacksRunAsyncMock.called).to.be.false;
	});
});
