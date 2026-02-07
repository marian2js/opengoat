export class OpenGoatProviderError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ProviderNotFoundError extends OpenGoatProviderError {
  public constructor(providerId: string, availableProviderIds: string[]) {
    super(
      `Unknown provider "${providerId}". Available providers: ${availableProviderIds.join(", ")}.`
    );
  }
}

export class UnsupportedProviderOptionError extends OpenGoatProviderError {
  public constructor(providerId: string, optionName: string) {
    super(`Provider "${providerId}" does not support ${optionName}.`);
  }
}

export class UnsupportedProviderActionError extends OpenGoatProviderError {
  public constructor(providerId: string, action: string) {
    super(`Provider "${providerId}" does not support action "${action}".`);
  }
}

export class ProviderCommandNotFoundError extends OpenGoatProviderError {
  public constructor(providerId: string, command: string) {
    super(
      `Provider "${providerId}" command "${command}" was not found or not executable.`
    );
  }
}

export class ProviderAuthenticationError extends OpenGoatProviderError {
  public constructor(providerId: string, message: string) {
    super(`Provider "${providerId}" authentication error: ${message}`);
  }
}

export class ProviderRuntimeError extends OpenGoatProviderError {
  public constructor(providerId: string, message: string) {
    super(`Provider "${providerId}" runtime error: ${message}`);
  }
}

export class AgentConfigNotFoundError extends OpenGoatProviderError {
  public constructor(agentId: string) {
    super(
      `Agent "${agentId}" was not found. Create it first with: opengoat agent create \"${agentId}\"`
    );
  }
}

export class InvalidAgentConfigError extends OpenGoatProviderError {
  public constructor(agentId: string, configPath: string, message = "invalid JSON") {
    super(`Agent "${agentId}" has an invalid config at ${configPath}: ${message}.`);
  }
}

export class InvalidProviderConfigError extends OpenGoatProviderError {
  public constructor(providerId: string, configPath: string, message = "invalid JSON") {
    super(`Provider "${providerId}" has an invalid config at ${configPath}: ${message}.`);
  }
}
