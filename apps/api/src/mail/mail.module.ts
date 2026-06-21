import { Module, Provider, Type } from '@nestjs/common';
import { MailService } from './mail.service';
import { SmtpMailService } from './smtp-mail.service';
import { ResendMailService } from './resend-mail.service';

export function selectMailService(): Type<MailService> {
  return process.env.MAIL_TRANSPORT === 'resend'
    ? ResendMailService
    : SmtpMailService;
}

const mailProvider: Provider = {
  provide: MailService,
  useClass: selectMailService(),
};

@Module({ providers: [mailProvider], exports: [MailService] })
export class MailModule {}
