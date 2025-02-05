class ExtractMessageFromEmailError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ExtractMessageFromEmailError';
  }
}
