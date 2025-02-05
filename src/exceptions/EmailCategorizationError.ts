class EmailCategorizationError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'EmailCategorizationError';
  }
}
