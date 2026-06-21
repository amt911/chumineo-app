const sendMail = jest.fn().mockResolvedValue(undefined);
jest.mock('nodemailer', () => ({ createTransport: () => ({ sendMail }) }));

import { SmtpMailService } from './smtp-mail.service';

describe('SmtpMailService', () => {
  it('sends a verification email via the transporter', async () => {
    await new SmtpMailService().sendVerificationEmail('u@test.com', 'tok');
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'u@test.com',
        subject: expect.stringMatching(/verif/i),
      }),
    );
  });
});
