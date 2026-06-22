import { Test } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  const users = {
    getPublicProfile: jest.fn().mockResolvedValue({
      username: 'neo',
      avatarUrl: null,
      memberSince: 'x',
    }),
  };
  let controller: UsersController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: users }],
    }).compile();
    controller = moduleRef.get(UsersController);
  });

  it('returns the public profile for a username', async () => {
    expect(await controller.profile('neo')).toEqual({
      username: 'neo',
      avatarUrl: null,
      memberSince: 'x',
    });
    expect(users.getPublicProfile).toHaveBeenCalledWith('neo');
  });
});
