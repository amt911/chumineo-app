import { selectMailService } from './mail.module';
import { SmtpMailService } from './smtp-mail.service';
import { ResendMailService } from './resend-mail.service';

describe('selectMailService', () => {
  const OLD = process.env.MAIL_TRANSPORT;
  afterEach(() => {
    if (OLD === undefined) delete process.env.MAIL_TRANSPORT;
    else process.env.MAIL_TRANSPORT = OLD;
  });

  it('returns ResendMailService when MAIL_TRANSPORT=resend', () => {
    process.env.MAIL_TRANSPORT = 'resend';
    expect(selectMailService()).toBe(ResendMailService);
  });

  it('returns SmtpMailService otherwise', () => {
    delete process.env.MAIL_TRANSPORT;
    expect(selectMailService()).toBe(SmtpMailService);
  });
});
