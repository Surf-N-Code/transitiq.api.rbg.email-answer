export class SendEmailError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'SendEmailError';
    this.cause = cause;
  }
}
