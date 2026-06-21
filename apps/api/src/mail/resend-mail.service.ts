import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { MailService } from './mail.service';
import { buildVerificationEmail } from './mail-templates';

@Injectable()
export class ResendMailService extends MailService {
  private readonly resend: Resend;
  private readonly from: string;

  constructor() {
    super();
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.from = process.env.MAIL_FROM ?? 'no-reply@sobrebox.local';
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const { subject, html, text } = buildVerificationEmail(token);
    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject,
      html,
      text,
    });
    if (error) throw new Error(`Resend send failed: ${error.message}`);
  }
}
