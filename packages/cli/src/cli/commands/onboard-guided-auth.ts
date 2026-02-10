export interface GuidedAuthDefinition {
  title: string;
  description: string;
}

export interface GuidedAuthResult {
  env: Record<string, string>;
  note?: string;
}

export interface GuidedAuthPrompter {
  intro?(label: string): Promise<void> | void;
  outro?(label: string): Promise<void> | void;
  note?(message: string, title?: string): Promise<void> | void;
  select?<T extends string>(
    message: string,
    options: Array<{ value: T; label: string; hint?: string }>,
    initialValue?: T
  ): Promise<T> | T;
  text?(options: {
    message: string;
    placeholder?: string;
    required?: boolean;
    secret?: boolean;
  }): Promise<string> | string;
  confirm?(message: string, initialValue?: boolean): Promise<boolean> | boolean;
}

export interface GuidedAuthContext {
  prompter: GuidedAuthPrompter;
}

export function resolveGuidedAuth(_providerId: string): GuidedAuthDefinition | undefined {
  return undefined;
}

export async function runGuidedAuth(providerId: string, _context: GuidedAuthContext): Promise<GuidedAuthResult> {
  throw new Error(`No guided auth flow registered for provider "${providerId}".`);
}
