export interface MailContent {
  subject: string;
  html: string;
  text: string;
}

export function buildVerificationEmail(token: string): MailContent {
  const base = process.env.WEB_PUBLIC_URL ?? 'http://localhost:3101';
  const link = `${base}/verify?token=${token}`;
  return {
    subject: 'Verify your SobreBox account',
    html: `<p>Welcome to SobreBox!</p><p>Confirm your email: <a href="${link}">${link}</a></p>`,
    text: `Welcome to SobreBox! Confirm your email: ${link}`,
  };
}
