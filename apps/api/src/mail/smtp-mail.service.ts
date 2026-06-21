import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { MailService } from './mail.service';
import { buildVerificationEmail } from './mail-templates';

@Injectable()
export class SmtpMailService extends MailService {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor() {
    super();
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_SMTP_HOST ?? 'localhost',
      port: Number(process.env.MAIL_SMTP_PORT ?? '1025'),
      secure: false,
    });
    this.from = process.env.MAIL_FROM ?? 'no-reply@sobrebox.local';
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const { subject, html, text } = buildVerificationEmail(token);
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      html,
      text,
    });
  }
}
