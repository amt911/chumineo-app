import { buildVerificationEmail } from './mail-templates';

describe('buildVerificationEmail', () => {
  it('embeds a verify link with the token', () => {
    process.env.WEB_PUBLIC_URL = 'http://localhost:3101';
    const { subject, html, text } = buildVerificationEmail('tok123');
    expect(subject).toMatch(/verif/i);
    expect(html).toContain('http://localhost:3101/verify?token=tok123');
    expect(text).toContain('tok123');
  });
});
