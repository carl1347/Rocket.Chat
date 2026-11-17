import { before, beforeEach, describe, it } from 'node:test';

import type { IRoom, IUser } from '@rocket.chat/core-typings';
import { mockModel } from '@rocket.chat/models/testing';
import { expect } from 'chai';
import p from 'proxyquire';
import sinon from 'sinon';

import { createFakeRoom, createFakeUser } from '../../../tests/mocks/data';

const modelsMock = {
	Users: { findUsersByUsernames: sinon.stub(), find: sinon.stub() },
	Rooms: { findOneDirectRoomContainingAllUserIDs: sinon.stub(), insertOne: sinon.stub(), findOneById: sinon.stub() },
	Subscriptions: { updateOne: sinon.stub() },
};

class ClientSafeError extends Error {}

const { createDirectRoom } = p.noCallThru().load('./createDirectRoom.ts', {
	'@rocket.chat/apps': { AppEvents: {}, Apps: { self: undefined } },
	'@rocket.chat/apps-engine/definition/exceptions': { AppsEngineException: class AppsEngineException extends Error {} },
	'@rocket.chat/core-services': { ClientSafeError },
	'@rocket.chat/random': { Random: { id: () => 'random-id' } },
	'../../settings': { settings: { get: () => 3 } },
	'../callbacks': { callbacks: { run: sinon.stub().resolves() } },
	'../notifyListener': {
		notifyOnRoomChangedById: sinon.stub(),
		notifyOnSubscriptionChangedByRoomIdAndUserId: sinon.stub(),
	},
	'../utils/lib/getDefaultSubscriptionPref': { getDefaultSubscriptionPref: () => ({}) },
});

const cursorOf = <T>(docs: T[]) => ({ toArray: async () => docs });

describe('createDirectRoom', () => {
	const alice = createFakeUser({ _id: 'alice-id', username: 'alice', name: 'Alice', active: true });
	const inactiveBob = createFakeUser({ _id: 'bob-id', username: 'bob', name: 'Bob', active: false });
	const activeBob = { ...inactiveBob, active: true } satisfies IUser;
	const sortedUids = ['alice-id', 'bob-id'];

	const arrangeMembers = (members: IUser[]) => {
		modelsMock.Users.findUsersByUsernames.returns(cursorOf(members));
		modelsMock.Users.find.returns(cursorOf(members));
	};

	const insertedRoom = () => modelsMock.Rooms.insertOne.firstCall.args[0] as Partial<IRoom>;

	before(() => {
		mockModel('Users', modelsMock.Users);
		mockModel('Rooms', modelsMock.Rooms);
		mockModel('Subscriptions', modelsMock.Subscriptions);
	});

	beforeEach(() => {
		[...Object.values(modelsMock.Users), ...Object.values(modelsMock.Rooms), ...Object.values(modelsMock.Subscriptions)].forEach((stub) =>
			stub.reset(),
		);

		modelsMock.Rooms.findOneDirectRoomContainingAllUserIDs.resolves(null);
		modelsMock.Rooms.insertOne.resolves({ insertedId: 'new-room-id' });
		modelsMock.Rooms.findOneById.resolves(createFakeRoom({ _id: 'new-room-id', t: 'd' }));
		modelsMock.Subscriptions.updateOne.resolves({ modifiedCount: 0, upsertedCount: 1 });
	});

	describe('read-only state', () => {
		it('should create the 1-to-1 room as read-only when one member is deactivated', async () => {
			// Arrange
			arrangeMembers([alice, inactiveBob]);

			// Act
			const result = await createDirectRoom(['alice', 'bob'], {}, { creator: alice._id });

			// Assert
			expect(result.inserted).to.be.true;
			expect(insertedRoom()).to.include({ t: 'd', ro: true, reactWhenReadOnly: false });
		});

		it('should create the room writable when both members are active', async () => {
			// Arrange
			arrangeMembers([alice, activeBob]);

			// Act
			await createDirectRoom(['alice', 'bob'], {}, { creator: alice._id });

			// Assert
			expect(insertedRoom()).to.not.have.property('ro');
			expect(insertedRoom()).to.not.have.property('reactWhenReadOnly');
		});

		it('should not make a group direct message read-only because one member is deactivated', async () => {
			// Arrange
			const carol = createFakeUser({ _id: 'carol-id', username: 'carol', name: 'Carol', active: true });
			arrangeMembers([alice, inactiveBob, carol]);

			// Act
			await createDirectRoom(['alice', 'bob', 'carol'], {}, { creator: alice._id });

			// Assert
			expect(insertedRoom()).to.not.have.property('ro');
		});
	});

	describe('idempotency', () => {
		it('should reuse the existing room instead of creating a second one for the same pair', async () => {
			// Arrange
			arrangeMembers([alice, activeBob]);
			modelsMock.Rooms.findOneDirectRoomContainingAllUserIDs.resolves(createFakeRoom({ _id: 'existing-room-id', t: 'd' }));

			// Act
			const result = await createDirectRoom(['alice', 'bob'], {}, { creator: alice._id });

			// Assert
			expect(modelsMock.Rooms.findOneDirectRoomContainingAllUserIDs.calledOnceWithExactly(sortedUids)).to.be.true;
			expect(modelsMock.Rooms.insertOne.called).to.be.false;
			expect(result).to.include({ _id: 'existing-room-id', rid: 'existing-room-id', inserted: false });
		});

		it('should look the pair up by sorted user ids whatever the order they were given in', async () => {
			// Arrange
			arrangeMembers([activeBob, alice]);

			// Act
			await createDirectRoom(['bob', 'alice'], {}, { creator: alice._id });

			// Assert
			expect(modelsMock.Rooms.findOneDirectRoomContainingAllUserIDs.calledOnceWithExactly(sortedUids)).to.be.true;
		});

		it('should skip the lookup and create a new room when forceNew is set', async () => {
			// Arrange
			arrangeMembers([alice, activeBob]);

			// Act
			const result = await createDirectRoom(['alice', 'bob'], {}, { creator: alice._id, forceNew: true });

			// Assert
			expect(modelsMock.Rooms.findOneDirectRoomContainingAllUserIDs.called).to.be.false;
			expect(modelsMock.Rooms.insertOne.calledOnce).to.be.true;
			expect(result.inserted).to.be.true;
		});
	});
});
