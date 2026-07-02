import { Test } from '@nestjs/testing';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

describe('MatchesController', () => {
  let controller: MatchesController;
  const matches = { getMatches: jest.fn().mockResolvedValue([]) };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [{ provide: MatchesService, useValue: matches }],
    }).compile();
    controller = mod.get(MatchesController);
  });

  it('delegates to the service with the current user id', async () => {
    const result = await controller.list({
      id: 'u1',
      email: 'u@x.com',
      username: 'u',
    });
    expect(matches.getMatches).toHaveBeenCalledWith('u1');
    expect(result).toEqual([]);
  });
});
