import { Authorization, Settings } from '@rocket.chat/core-services';
import { TeamType } from '@rocket.chat/core-typings';
import type { IRoom, ISubscription, ITeam, IUser } from '@rocket.chat/core-typings';
import { mockModel } from '@rocket.chat/models/testing';

import { canAccessRoom } from './canAccessRoom';
import { canAccessRoomLivechat } from './canAccessRoomLivechat';

jest.mock('@rocket.chat/core-services', () => ({
	Authorization: {
		hasPermission: jest.fn(),
		canAccessRoom: jest.fn(),
	},
	License: {
		hasModule: jest.fn(),
	},
	Abac: {
		canAccessObject: jest.fn(),
	},
	Settings: {
		get: jest.fn(),
	},
}));

jest.mock('./canAccessRoomLivechat', () => ({
	canAccessRoomLivechat: jest.fn(),
}));

const findOneUserById = jest.fn();
const findOneBannedSubscription = jest.fn();
const countSubscriptionsByRoomIdAndUserId = jest.fn();
const findOneTeamById = jest.fn();
const findOneTeamMember = jest.fn();
const hasPermission = jest.mocked(Authorization.hasPermission);
const getSetting = jest.mocked(Settings.get);

describe('canAccessRoom', () => {
	beforeAll(() => {
		mockModel('Subscriptions', {
			findOneBannedSubscription,
			countByRoomIdAndUserId: countSubscriptionsByRoomIdAndUserId,
		});
		mockModel('Users', { findOneById: findOneUserById });
		mockModel('Team', { findOneById: findOneTeamById });
		mockModel('TeamMember', { findOneByUserIdAndTeamId: findOneTeamMember });
	});

	beforeEach(() => {
		jest.resetAllMocks();

		// sane defaults: everything denies access unless a test says otherwise
		findOneUserById.mockResolvedValue(null);
		hasPermission.mockResolvedValue(false);
		getSetting.mockResolvedValue(false);
		jest.mocked(canAccessRoomLivechat).mockResolvedValue(false);
		findOneBannedSubscription.mockResolvedValue(null);
		countSubscriptionsByRoomIdAndUserId.mockResolvedValue(0);
		findOneTeamById.mockResolvedValue(null);
		findOneTeamMember.mockResolvedValue(null);
	});

	describe('user hydration', () => {
		it('should hydrate a partial user before running the validators', async () => {
			const fullUser = { _id: 'user-id', username: 'john.doe', roles: ['user'] } as IUser;
			findOneUserById.mockResolvedValue(fullUser);
			hasPermission.mockResolvedValue(true);

			const result = await canAccessRoom({ _id: 'room-id', t: 'c' }, { _id: 'user-id' });

			expect(result).toBe(true);
			expect(findOneUserById).toHaveBeenCalledTimes(1);
			expect(findOneUserById).toHaveBeenCalledWith('user-id');
			expect(hasPermission).toHaveBeenCalledWith(fullUser, 'view-c-room');
		});

		it('should throw when the partial user cannot be found', async () => {
			await expect(canAccessRoom({ _id: 'room-id', t: 'c' }, { _id: 'user-id' })).rejects.toThrow('User not found');
		});

		it('should not hydrate a full user', async () => {
			await canAccessRoom({ _id: 'room-id', t: 'c' }, { _id: 'user-id', username: 'john.doe' } as IUser);

			expect(findOneUserById).not.toHaveBeenCalled();
		});

		it('should not hydrate an undefined user', async () => {
			await canAccessRoom({ _id: 'room-id', t: 'c' }, undefined);

			expect(findOneUserById).not.toHaveBeenCalled();
		});

		it('should not hydrate a user whose _id is undefined, and treat it as anonymous instead of throwing when anonymous read is on', async () => {
			getSetting.mockResolvedValue(true);

			const result = await canAccessRoom({ _id: 'room-id', t: 'c' }, { _id: undefined });

			expect(findOneUserById).not.toHaveBeenCalled();
			expect(getSetting).toHaveBeenCalledWith('Accounts_AllowAnonymousRead');
			expect(result).toBe(true);
		});

		it('should deny access to a user whose _id is undefined when anonymous read is off', async () => {
			getSetting.mockResolvedValue(false);

			const result = await canAccessRoom({ _id: 'room-id', t: 'c' }, { _id: undefined });

			expect(findOneUserById).not.toHaveBeenCalled();
			expect(result).toBe(false);
		});
	});

	describe('public rooms of a team', () => {
		const user = { _id: 'user-id', username: 'john.doe' } as IUser;
		const teamRoom: Pick<IRoom, '_id' | 't' | 'teamId'> = { _id: 'room-id', t: 'c', teamId: 'team-id' };
		const bannedSubscription = { _id: 'sub-id', rid: 'room-id', status: 'BANNED' } as unknown as ISubscription;

		beforeEach(() => {
			// the team is public and the user holds view-c-room, so only the ban can deny access
			findOneTeamById.mockResolvedValue({ _id: 'team-id', type: TeamType.PUBLIC } as ITeam);
			hasPermission.mockResolvedValue(true);
		});

		it('should deny access when the user has an active banned subscription in the room', async () => {
			// Arrange
			findOneBannedSubscription.mockResolvedValue(bannedSubscription);

			// Act
			const result = await canAccessRoom(teamRoom, user);

			// Assert
			expect(result).toBe(false);
			expect(findOneBannedSubscription).toHaveBeenCalledWith('room-id', 'user-id');
			expect(findOneTeamById).not.toHaveBeenCalled();
		});

		it('should allow access when the user has no banned subscription and can view public rooms', async () => {
			// Arrange
			findOneBannedSubscription.mockResolvedValue(null);

			// Act
			const result = await canAccessRoom(teamRoom, user);

			// Assert
			expect(result).toBe(true);
			expect(findOneBannedSubscription).toHaveBeenCalledWith('room-id', 'user-id');
			expect(hasPermission).toHaveBeenCalledWith(user, 'view-c-room');
		});

		it('should not look for a banned subscription for an anonymous visitor', async () => {
			// Arrange
			getSetting.mockResolvedValue(true);

			// Act
			const result = await canAccessRoom(teamRoom, undefined);

			// Assert
			expect(result).toBe(true);
			expect(findOneBannedSubscription).not.toHaveBeenCalled();
		});
	});

	describe('public rooms without a team', () => {
		const user = { _id: 'user-id', username: 'john.doe' } as IUser;

		it('should deny access when the user has an active banned subscription in the room', async () => {
			// Arrange
			hasPermission.mockResolvedValue(true);
			findOneBannedSubscription.mockResolvedValue({ _id: 'sub-id', rid: 'room-id' } as unknown as ISubscription);

			// Act
			const result = await canAccessRoom({ _id: 'room-id', t: 'c' }, user);

			// Assert
			expect(result).toBe(false);
			expect(findOneBannedSubscription).toHaveBeenCalledWith('room-id', 'user-id');
		});
	});
});
