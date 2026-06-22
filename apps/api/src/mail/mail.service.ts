// Abstract class used as the Nest DI token so consumers depend on the interface,
// not a concrete transport.
export abstract class MailService {
  abstract sendVerificationEmail(to: string, token: string): Promise<void>;
}
