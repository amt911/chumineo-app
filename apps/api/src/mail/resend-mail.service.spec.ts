const send = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send } })),
}));

import { ResendMailService } from './resend-mail.service';

describe('ResendMailService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends via Resend', async () => {
    send.mockResolvedValueOnce({ error: null });
    await new ResendMailService().sendVerificationEmail('u@test.com', 'tok');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'u@test.com' }),
    );
  });

  it('throws when Resend returns an error', async () => {
    send.mockResolvedValueOnce({ error: { message: 'boom' } });
    await expect(
      new ResendMailService().sendVerificationEmail('u@test.com', 'tok'),
    ).rejects.toThrow(/boom/);
  });
});
