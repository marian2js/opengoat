export class SessionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class SessionStoreParseError extends SessionError {
  public constructor(filePath: string) {
    super(`Session store is invalid JSON or schema at ${filePath}.`);
  }
}

export class SessionTranscriptParseError extends SessionError {
  public constructor(filePath: string) {
    super(`Session transcript contains invalid JSON at ${filePath}.`);
  }
}

export class SessionConfigParseError extends SessionError {
  public constructor(filePath: string) {
    super(`Agent session config is invalid JSON at ${filePath}.`);
  }
}
