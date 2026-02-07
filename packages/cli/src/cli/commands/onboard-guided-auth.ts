import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { delimiter, dirname, join } from "node:path";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import type { CliPrompter } from "../framework/prompter.js";

export interface GuidedAuthResult {
  env: Record<string, string>;
  note?: string;
}

interface GuidedAuthContext {
  prompter: CliPrompter;
}

type GuidedAuthHandler = (context: GuidedAuthContext) => Promise<GuidedAuthResult>;

type GuidedAuthDefinition = {
  title: string;
  description: string;
  run: GuidedAuthHandler;
};

type DeviceCodeResponse = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  expiresInSec: number;
  intervalSec?: number;
};

type OAuthTokenResponse = {
  accessToken: string;
  refreshToken?: string;
  expiresAtMs?: number;
};

type OAuthProgress = { update: (message: string) => void; stop: (message?: string) => void };

const QWEN_CLIENT_ID = "f0304373b74a44d2b584a3fb70ca9e56";
const QWEN_BASE_URL = "https://chat.qwen.ai";
const QWEN_DEVICE_CODE_ENDPOINT = `${QWEN_BASE_URL}/api/v1/oauth2/device/code`;
const QWEN_TOKEN_ENDPOINT = `${QWEN_BASE_URL}/api/v1/oauth2/token`;
const QWEN_SCOPE = "openid profile email model.completion";

const MINIMAX_CLIENT_ID = "78257093-7e40-4613-99e0-527b14b39113";
const MINIMAX_GLOBAL_BASE_URL = "https://api.minimax.io";
const MINIMAX_CN_BASE_URL = "https://api.minimaxi.com";
const MINIMAX_SCOPE = "group_id profile model.completion";

const GITHUB_COPILOT_CLIENT_ID = "Iv1.b507a08c87ecfe98";
const GITHUB_DEVICE_CODE_ENDPOINT = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";

const CHUTES_OAUTH_ISSUER = "https://api.chutes.ai";
const CHUTES_AUTHORIZE_ENDPOINT = `${CHUTES_OAUTH_ISSUER}/idp/authorize`;
const CHUTES_TOKEN_ENDPOINT = `${CHUTES_OAUTH_ISSUER}/idp/token`;
const CHUTES_DEFAULT_REDIRECT_URI = "http://127.0.0.1:1456/oauth-callback";
const CHUTES_DEFAULT_SCOPES = "openid profile chutes:invoke";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CODE_ASSIST_BASE_URL = "https://cloudcode-pa.googleapis.com";
const GOOGLE_CODE_ASSIST_OPENAI_BASE_URL = `${GOOGLE_CODE_ASSIST_BASE_URL}/v1`;
const GOOGLE_DEFAULT_PROJECT_ID = "rising-fact-p41fc";
const GOOGLE_CODE_ASSIST_SCOPES = [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/cclog",
  "https://www.googleapis.com/auth/experimentsandconfigs"
].join(" ");
const GOOGLE_ANTIGRAVITY_REDIRECT_URI = "http://localhost:51121/oauth-callback";
const GOOGLE_ANTIGRAVITY_CLIENT_ID =
  "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
const GOOGLE_ANTIGRAVITY_CLIENT_SECRET = "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";
const GOOGLE_GEMINI_CLI_REDIRECT_URI = "http://localhost:8085/oauth2callback";
const GEMINI_CLI_CLIENT_ID_ENV_KEYS = ["OPENCLAW_GEMINI_OAUTH_CLIENT_ID", "GEMINI_CLI_OAUTH_CLIENT_ID"];
const GEMINI_CLI_CLIENT_SECRET_ENV_KEYS = [
  "OPENCLAW_GEMINI_OAUTH_CLIENT_SECRET",
  "GEMINI_CLI_OAUTH_CLIENT_SECRET"
];

const guidedAuthByProviderId = new Map<string, GuidedAuthDefinition>([
  [
    "qwen-portal",
    {
      title: "Qwen OAuth",
      description: "Open browser and approve access (recommended).",
      run: runQwenOAuthFlow
    }
  ],
  [
    "minimax-portal",
    {
      title: "MiniMax OAuth",
      description: "Open browser and approve access (recommended).",
      run: runMiniMaxOAuthFlow
    }
  ],
  [
    "github-copilot",
    {
      title: "GitHub Copilot Login",
      description: "Use GitHub device login and save the token automatically.",
      run: runGitHubCopilotDeviceFlow
    }
  ],
  [
    "copilot-proxy",
    {
      title: "GitHub Copilot Login",
      description: "Use GitHub device login and reuse the token for Copilot Proxy.",
      run: runGitHubCopilotDeviceFlow
    }
  ],
  [
    "chutes",
    {
      title: "Chutes OAuth",
      description: "Open browser and approve access (recommended).",
      run: runChutesOAuthFlow
    }
  ],
  [
    "google-antigravity",
    {
      title: "Google Antigravity OAuth",
      description: "Open browser and approve access (recommended).",
      run: runGoogleAntigravityOAuthFlow
    }
  ],
  [
    "google-gemini-cli",
    {
      title: "Google Gemini CLI OAuth",
      description: "Open browser and approve access (recommended).",
      run: runGoogleGeminiCliOAuthFlow
    }
  ]
]);

export function resolveGuidedAuth(providerId: string): GuidedAuthDefinition | undefined {
  return guidedAuthByProviderId.get(providerId.trim().toLowerCase());
}

export async function runGuidedAuth(providerId: string, context: GuidedAuthContext): Promise<GuidedAuthResult> {
  const auth = resolveGuidedAuth(providerId);
  if (!auth) {
    throw new Error(`No guided auth flow registered for provider "${providerId}".`);
  }
  return auth.run(context);
}

async function runQwenOAuthFlow(context: GuidedAuthContext): Promise<GuidedAuthResult> {
  const progress = context.prompter.progress("Starting Qwen OAuth...");
  try {
    const { challenge, verifier } = generatePkceChallenge();
    const device = await requestQwenDeviceCode(challenge);
    const verificationUrl = device.verificationUriComplete || device.verificationUri;

    await context.prompter.note(
      `Open ${verificationUrl}\nIf prompted, enter code: ${device.userCode}`,
      "Qwen OAuth"
    );
    await openUrlBestEffort(verificationUrl);

    const pollIntervalMs = Math.max(1_000, (device.intervalSec ?? 2) * 1_000);
    const timeoutMs = Math.max(10_000, device.expiresInSec * 1_000);
    const token = await pollUntilToken({
      timeoutMs,
      intervalMs: pollIntervalMs,
      progress,
      waitingMessage: "Waiting for Qwen OAuth approval...",
      poll: async () => await requestQwenToken({
        grantType: "urn:ietf:params:oauth:grant-type:device_code",
        deviceCode: device.deviceCode,
        verifier
      })
    });

    progress.stop("Qwen OAuth complete.");
    const env: Record<string, string> = {
      QWEN_OAUTH_TOKEN: token.accessToken
    };
    if (token.refreshToken) {
      env.QWEN_OAUTH_REFRESH_TOKEN = token.refreshToken;
    }
    if (token.expiresAtMs) {
      env.QWEN_OAUTH_EXPIRES_AT = String(token.expiresAtMs);
    }

    return {
      env,
      note: "Saved Qwen OAuth token. Re-run onboarding if access is revoked."
    };
  } catch (error) {
    progress.stop("Qwen OAuth failed.");
    throw error;
  }
}

async function runMiniMaxOAuthFlow(context: GuidedAuthContext): Promise<GuidedAuthResult> {
  const region = await context.prompter.select(
    "MiniMax OAuth region",
    [
      { value: "global", label: "Global (api.minimax.io)" },
      { value: "cn", label: "China (api.minimaxi.com)" }
    ],
    "global"
  );

  const progress = context.prompter.progress("Starting MiniMax OAuth...");
  try {
    const { challenge, verifier, state } = generatePkceChallengeWithState();
    const baseUrl = region === "cn" ? MINIMAX_CN_BASE_URL : MINIMAX_GLOBAL_BASE_URL;
    const device = await requestMiniMaxCode({ baseUrl, challenge, state });

    await context.prompter.note(
      `Open ${device.verificationUri}\nIf prompted, enter code: ${device.userCode}`,
      "MiniMax OAuth"
    );
    await openUrlBestEffort(device.verificationUri);

    const pollIntervalMs = Math.max(1_000, device.intervalSec ?? 2_000);
    const timeoutMs = Math.max(10_000, device.expiresAtMs - Date.now());
    const token = await pollUntilToken({
      timeoutMs,
      intervalMs: pollIntervalMs,
      progress,
      waitingMessage: "Waiting for MiniMax OAuth approval...",
      poll: async () =>
        await requestMiniMaxToken({
          baseUrl,
          userCode: device.userCode,
          verifier
        })
    });

    progress.stop("MiniMax OAuth complete.");
    const env: Record<string, string> = {
      MINIMAX_OAUTH_TOKEN: token.accessToken,
      MINIMAX_PORTAL_BASE_URL: `${baseUrl}/anthropic`
    };
    if (token.refreshToken) {
      env.MINIMAX_OAUTH_REFRESH_TOKEN = token.refreshToken;
    }
    if (token.expiresAtMs) {
      env.MINIMAX_OAUTH_EXPIRES_AT = String(token.expiresAtMs);
    }

    return {
      env,
      note: "Saved MiniMax OAuth token. Re-run onboarding if refresh fails."
    };
  } catch (error) {
    progress.stop("MiniMax OAuth failed.");
    throw error;
  }
}

async function runGitHubCopilotDeviceFlow(context: GuidedAuthContext): Promise<GuidedAuthResult> {
  const progress = context.prompter.progress("Starting GitHub device login...");
  try {
    const device = await requestGitHubDeviceCode();
    await context.prompter.note(
      `Open ${device.verificationUri}\nEnter code: ${device.userCode}`,
      "GitHub Copilot"
    );
    await openUrlBestEffort(device.verificationUri);

    const pollIntervalMs = Math.max(1_000, (device.intervalSec ?? 5) * 1_000);
    const timeoutMs = Math.max(10_000, device.expiresInSec * 1_000);
    const token = await pollUntilToken({
      timeoutMs,
      intervalMs: pollIntervalMs,
      progress,
      waitingMessage: "Waiting for GitHub approval...",
      poll: async () => await requestGitHubAccessToken(device.deviceCode)
    });

    progress.stop("GitHub login complete.");
    return {
      env: {
        COPILOT_GITHUB_TOKEN: token.accessToken
      },
      note: "Saved GitHub token for Copilot."
    };
  } catch (error) {
    progress.stop("GitHub device login failed.");
    throw error;
  }
}

async function runChutesOAuthFlow(context: GuidedAuthContext): Promise<GuidedAuthResult> {
  const clientId =
    process.env.CHUTES_CLIENT_ID?.trim() ||
    (await context.prompter.text({
      message: "Chutes OAuth client ID (CHUTES_CLIENT_ID)",
      required: true
    })).trim();
  const clientSecret = process.env.CHUTES_CLIENT_SECRET?.trim() || undefined;
  const redirectUri = process.env.CHUTES_OAUTH_REDIRECT_URI?.trim() || CHUTES_DEFAULT_REDIRECT_URI;
  const scopes = process.env.CHUTES_OAUTH_SCOPES?.trim() || CHUTES_DEFAULT_SCOPES;

  const progress = context.prompter.progress("Starting Chutes OAuth...");
  try {
    const { challenge, verifier, state } = generatePkceChallengeWithState();
    const authorizeUrl = buildChutesAuthorizeUrl({
      clientId,
      redirectUri,
      scopes,
      state,
      challenge
    });

    await context.prompter.note(
      `Open ${authorizeUrl}\nApprove access, then return here.`,
      "Chutes OAuth"
    );
    await openUrlBestEffort(authorizeUrl);

    const code = await waitForOAuthCodeWithFallback({
      title: "Chutes OAuth",
      progress,
      prompter: context.prompter,
      redirectUri,
      expectedState: state,
      timeoutMs: 3 * 60_000
    });

    progress.update("Exchanging Chutes authorization code...");
    const token = await requestChutesToken({
      clientId,
      clientSecret,
      redirectUri,
      code,
      verifier
    });

    progress.stop("Chutes OAuth complete.");
    const env: Record<string, string> = {
      CHUTES_OAUTH_TOKEN: token.accessToken,
      CHUTES_CLIENT_ID: clientId
    };
    if (token.refreshToken) {
      env.CHUTES_OAUTH_REFRESH_TOKEN = token.refreshToken;
    }
    if (token.expiresAtMs) {
      env.CHUTES_OAUTH_EXPIRES_AT = String(token.expiresAtMs);
    }

    return {
      env,
      note: "Saved Chutes OAuth token."
    };
  } catch (error) {
    progress.stop("Chutes OAuth failed.");
    await context.prompter.note(
      "If your app requires a client secret, set CHUTES_CLIENT_SECRET and retry.\nDocs: https://chutes.ai/docs/sign-in-with-chutes/overview",
      "Chutes OAuth"
    );
    throw error;
  }
}

async function runGoogleAntigravityOAuthFlow(context: GuidedAuthContext): Promise<GuidedAuthResult> {
  const progress = context.prompter.progress("Starting Google Antigravity OAuth...");
  try {
    const token = await runGoogleCodeAssistOAuth({
      title: "Google Antigravity OAuth",
      progress,
      prompter: context.prompter,
      clientId: GOOGLE_ANTIGRAVITY_CLIENT_ID,
      clientSecret: GOOGLE_ANTIGRAVITY_CLIENT_SECRET,
      redirectUri: GOOGLE_ANTIGRAVITY_REDIRECT_URI
    });

    progress.stop("Google Antigravity OAuth complete.");
    const env: Record<string, string> = {
      GOOGLE_ANTIGRAVITY_TOKEN: token.accessToken,
      GOOGLE_ANTIGRAVITY_BASE_URL: GOOGLE_CODE_ASSIST_OPENAI_BASE_URL
    };
    if (token.refreshToken) {
      env.GOOGLE_ANTIGRAVITY_REFRESH_TOKEN = token.refreshToken;
    }
    if (token.expiresAtMs) {
      env.GOOGLE_ANTIGRAVITY_EXPIRES_AT = String(token.expiresAtMs);
    }
    if (token.projectId) {
      env.GOOGLE_ANTIGRAVITY_PROJECT_ID = token.projectId;
    }
    return {
      env,
      note: "Saved Google Antigravity OAuth token."
    };
  } catch (error) {
    progress.stop("Google Antigravity OAuth failed.");
    await context.prompter.note(
      "Trouble signing in? Retry and ensure your Google account has Code Assist access.",
      "Google Antigravity OAuth"
    );
    throw error;
  }
}

async function runGoogleGeminiCliOAuthFlow(context: GuidedAuthContext): Promise<GuidedAuthResult> {
  const extracted = resolveGeminiCliClientConfig();
  const clientId =
    extracted?.clientId ||
    (await context.prompter.text({
      message: "Gemini OAuth client ID (install gemini-cli or set GEMINI_CLI_OAUTH_CLIENT_ID)",
      required: true
    })).trim();
  const clientSecret = extracted?.clientSecret?.trim() || undefined;

  const progress = context.prompter.progress("Starting Google Gemini CLI OAuth...");
  try {
    const token = await runGoogleCodeAssistOAuth({
      title: "Google Gemini CLI OAuth",
      progress,
      prompter: context.prompter,
      clientId,
      clientSecret,
      redirectUri: GOOGLE_GEMINI_CLI_REDIRECT_URI
    });

    progress.stop("Google Gemini CLI OAuth complete.");
    const env: Record<string, string> = {
      GOOGLE_GEMINI_CLI_OAUTH_TOKEN: token.accessToken,
      GOOGLE_GEMINI_CLI_BASE_URL: GOOGLE_CODE_ASSIST_OPENAI_BASE_URL
    };
    if (token.refreshToken) {
      env.GOOGLE_GEMINI_CLI_OAUTH_REFRESH_TOKEN = token.refreshToken;
    }
    if (token.expiresAtMs) {
      env.GOOGLE_GEMINI_CLI_OAUTH_EXPIRES_AT = String(token.expiresAtMs);
    }
    if (token.projectId) {
      env.GOOGLE_GEMINI_CLI_PROJECT_ID = token.projectId;
    }
    return {
      env,
      note: "Saved Google Gemini CLI OAuth token."
    };
  } catch (error) {
    progress.stop("Google Gemini CLI OAuth failed.");
    await context.prompter.note(
      "Install gemini-cli or set GEMINI_CLI_OAUTH_CLIENT_ID/GEMINI_CLI_OAUTH_CLIENT_SECRET, then retry.",
      "Google Gemini CLI OAuth"
    );
    throw error;
  }
}

async function runGoogleCodeAssistOAuth(params: {
  title: string;
  progress: OAuthProgress;
  prompter: CliPrompter;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
}): Promise<OAuthTokenResponse & { projectId?: string }> {
  const { challenge, verifier, state } = generatePkceChallengeWithState();
  const authorizeUrl = buildGoogleAuthorizeUrl({
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    challenge,
    state
  });

  await params.prompter.note(
    `Open ${authorizeUrl}\nApprove access, then return here.`,
    params.title
  );
  await openUrlBestEffort(authorizeUrl);

  const code = await waitForOAuthCodeWithFallback({
    title: params.title,
    progress: params.progress,
    prompter: params.prompter,
    redirectUri: params.redirectUri,
    expectedState: state,
    timeoutMs: 5 * 60_000
  });

  params.progress.update("Exchanging Google authorization code...");
  const token = await requestGoogleToken({
    clientId: params.clientId,
    clientSecret: params.clientSecret,
    redirectUri: params.redirectUri,
    code,
    verifier
  });
  const projectId = await fetchGoogleCodeAssistProjectId(token.accessToken);

  return {
    ...token,
    projectId: projectId || undefined
  };
}

async function waitForOAuthCodeWithFallback(params: {
  title: string;
  progress: OAuthProgress;
  prompter: CliPrompter;
  redirectUri: string;
  expectedState: string;
  timeoutMs: number;
}): Promise<string> {
  try {
    const callback = await waitForOAuthCallback({
      redirectUri: params.redirectUri,
      expectedState: params.expectedState,
      timeoutMs: params.timeoutMs,
      progress: params.progress
    });
    return callback.code;
  } catch {
    params.progress.update("Waiting for pasted redirect URL...");
    await params.prompter.note(
      `If the browser callback did not complete, paste the full redirect URL from ${params.redirectUri}.`,
      params.title
    );
    while (true) {
      const input = await params.prompter.text({
        message: `${params.title}: paste redirect URL`,
        required: true
      });
      const parsed = parseOAuthCallbackInput(input, params.expectedState);
      if (!parsed.ok) {
        await params.prompter.note(parsed.error, params.title);
        continue;
      }
      return parsed.code;
    }
  }
}

async function waitForOAuthCallback(params: {
  redirectUri: string;
  expectedState: string;
  timeoutMs: number;
  progress: OAuthProgress;
}): Promise<{ code: string }> {
  const redirect = new URL(params.redirectUri);
  if (redirect.protocol !== "http:") {
    throw new Error(`OAuth redirect URI must be http:// (got ${params.redirectUri})`);
  }
  const host = redirect.hostname || "127.0.0.1";
  const port = redirect.port ? Number.parseInt(redirect.port, 10) : 80;
  const expectedPath = redirect.pathname || "/";

  return await new Promise<{ code: string }>((resolve, reject) => {
    let timer: NodeJS.Timeout | undefined;
    let settled = false;

    const finish = (result?: { code: string }, error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      server.close();
      if (error) {
        reject(error);
        return;
      }
      if (result) {
        resolve(result);
        return;
      }
      reject(new Error("OAuth callback failed"));
    };

    const server = createServer((request, response) => {
      try {
        const url = new URL(request.url ?? "/", `${redirect.protocol}//${redirect.host}`);
        if (url.pathname !== expectedPath) {
          response.statusCode = 404;
          response.setHeader("content-type", "text/plain; charset=utf-8");
          response.end("Not found");
          return;
        }

        const code = url.searchParams.get("code")?.trim();
        const state = url.searchParams.get("state")?.trim();
        if (!code || !state || state !== params.expectedState) {
          response.statusCode = 400;
          response.setHeader("content-type", "text/plain; charset=utf-8");
          response.end("Invalid OAuth callback.");
          finish(undefined, new Error("OAuth callback validation failed"));
          return;
        }

        response.statusCode = 200;
        response.setHeader("content-type", "text/html; charset=utf-8");
        response.end(
          "<!doctype html><html><body><h2>Authentication complete</h2><p>Return to your terminal.</p></body></html>"
        );
        finish({ code });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        finish(undefined, new Error(message));
      }
    });

    server.once("error", (error) => {
      finish(undefined, error instanceof Error ? error : new Error(String(error)));
    });

    server.listen(port, host, () => {
      params.progress.update(`Waiting for OAuth callback on ${params.redirectUri}...`);
    });

    timer = setTimeout(() => {
      finish(undefined, new Error("OAuth callback timed out."));
    }, params.timeoutMs);
  });
}

function parseOAuthCallbackInput(
  input: string,
  expectedState: string
): { ok: true; code: string } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "No input provided." };
  }

  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get("code")?.trim();
    const state = url.searchParams.get("state")?.trim();
    if (!code) {
      return { ok: false, error: "Missing 'code' parameter in URL." };
    }
    if (!state) {
      return { ok: false, error: "Missing 'state' parameter in URL." };
    }
    if (state !== expectedState) {
      return { ok: false, error: "OAuth state mismatch. Try again." };
    }
    return { ok: true, code };
  } catch {
    return { ok: false, error: "Paste the full redirect URL (not just the code)." };
  }
}

function buildChutesAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  scopes: string;
  state: string;
  challenge: string;
}): string {
  const url = new URL(CHUTES_AUTHORIZE_ENDPOINT);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", params.scopes);
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

async function requestChutesToken(params: {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  code: string;
  verifier: string;
}): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: params.clientId,
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.verifier
  });
  if (params.clientSecret?.trim()) {
    body.set("client_secret", params.clientSecret.trim());
  }

  const response = await fetch(CHUTES_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json"
    },
    body
  });
  const payload = await parseJsonOrText(response);
  const asObject = payloadAsObject(payload);
  if (!response.ok) {
    throw new Error(`Chutes OAuth token exchange failed: ${payload}`);
  }

  const accessToken = readString(asObject.access_token);
  const refreshToken = readOptionalString(asObject.refresh_token);
  const expiresInSec = readNumber(asObject.expires_in);
  if (!accessToken) {
    throw new Error("Chutes OAuth token payload is missing access token.");
  }

  const now = Date.now();
  const expiresAtMs =
    expiresInSec && Number.isFinite(expiresInSec)
      ? Math.max(now + 30_000, now + expiresInSec * 1_000 - 5 * 60_000)
      : undefined;

  return {
    accessToken,
    refreshToken: refreshToken ?? undefined,
    expiresAtMs
  };
}

function buildGoogleAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  challenge: string;
  state: string;
}): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", GOOGLE_CODE_ASSIST_SCOPES);
  url.searchParams.set("code_challenge", params.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", params.state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

async function requestGoogleToken(params: {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  code: string;
  verifier: string;
}): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    code: params.code,
    grant_type: "authorization_code",
    redirect_uri: params.redirectUri,
    code_verifier: params.verifier
  });
  if (params.clientSecret?.trim()) {
    body.set("client_secret", params.clientSecret.trim());
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json"
    },
    body
  });
  const payload = await parseJsonOrText(response);
  const asObject = payloadAsObject(payload);
  if (!response.ok) {
    throw new Error(`Google OAuth token exchange failed: ${payload}`);
  }

  const accessToken = readString(asObject.access_token);
  const refreshToken = readOptionalString(asObject.refresh_token);
  const expiresInSec = readNumber(asObject.expires_in);
  if (!accessToken) {
    throw new Error("Google OAuth token payload is missing access token.");
  }

  const now = Date.now();
  const expiresAtMs =
    expiresInSec && Number.isFinite(expiresInSec)
      ? Math.max(now + 30_000, now + expiresInSec * 1_000 - 5 * 60_000)
      : undefined;

  return {
    accessToken,
    refreshToken: refreshToken ?? undefined,
    expiresAtMs
  };
}

async function fetchGoogleCodeAssistProjectId(accessToken: string): Promise<string | null> {
  const headers = {
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json"
  };
  const body = JSON.stringify({
    metadata: {
      ideType: "IDE_UNSPECIFIED",
      platform: "PLATFORM_UNSPECIFIED",
      pluginType: "GEMINI"
    }
  });

  const response = await fetch(`${GOOGLE_CODE_ASSIST_BASE_URL}/v1internal:loadCodeAssist`, {
    method: "POST",
    headers,
    body
  });
  if (!response.ok) {
    return GOOGLE_DEFAULT_PROJECT_ID;
  }

  const payload = await parseJsonOrText(response);
  const asObject = payloadAsObject(payload);
  const rawProject = asObject.cloudaicompanionProject;
  if (typeof rawProject === "string" && rawProject.trim()) {
    return rawProject.trim();
  }
  if (rawProject && typeof rawProject === "object" && !Array.isArray(rawProject)) {
    const fromObject = readOptionalString((rawProject as Record<string, unknown>).id);
    if (fromObject) {
      return fromObject;
    }
  }
  return GOOGLE_DEFAULT_PROJECT_ID;
}

function resolveGeminiCliClientConfig(): { clientId: string; clientSecret?: string } | null {
  const envClientId = resolveFirstEnvValue(GEMINI_CLI_CLIENT_ID_ENV_KEYS);
  const envClientSecret = resolveFirstEnvValue(GEMINI_CLI_CLIENT_SECRET_ENV_KEYS);
  if (envClientId) {
    return { clientId: envClientId, clientSecret: envClientSecret ?? undefined };
  }

  const extracted = extractGeminiCliCredentials();
  if (extracted) {
    return extracted;
  }

  return null;
}

function resolveFirstEnvValue(keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}

function extractGeminiCliCredentials(): { clientId: string; clientSecret: string } | null {
  try {
    const geminiPath = findBinaryInPath("gemini");
    if (!geminiPath) {
      return null;
    }
    const resolvedPath = realpathSync(geminiPath);
    const geminiRoot = dirname(dirname(resolvedPath));
    const candidatePaths = [
      join(
        geminiRoot,
        "node_modules",
        "@google",
        "gemini-cli-core",
        "dist",
        "src",
        "code_assist",
        "oauth2.js"
      ),
      join(geminiRoot, "node_modules", "@google", "gemini-cli-core", "dist", "code_assist", "oauth2.js")
    ];

    let content: string | null = null;
    for (const candidate of candidatePaths) {
      if (!existsSync(candidate)) {
        continue;
      }
      content = readFileSync(candidate, "utf8");
      break;
    }

    if (!content) {
      const discovered = findFileByName(geminiRoot, "oauth2.js", 10);
      if (!discovered) {
        return null;
      }
      content = readFileSync(discovered, "utf8");
    }

    const idMatch = content.match(/(\d+-[a-z0-9]+\.apps\.googleusercontent\.com)/i);
    const secretMatch = content.match(/(GOCSPX-[A-Za-z0-9_-]+)/);
    if (!idMatch?.[1] || !secretMatch?.[1]) {
      return null;
    }

    return {
      clientId: idMatch[1],
      clientSecret: secretMatch[1]
    };
  } catch {
    return null;
  }
}

function findBinaryInPath(name: string): string | null {
  const extensions = process.platform === "win32" ? [".cmd", ".bat", ".exe", ""] : [""];
  const pathValue = process.env.PATH ?? "";
  for (const pathEntry of pathValue.split(delimiter)) {
    for (const extension of extensions) {
      const candidate = join(pathEntry, `${name}${extension}`);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

function findFileByName(rootDir: string, fileName: string, depth: number): string | null {
  if (depth <= 0) {
    return null;
  }

  try {
    for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
      const entryPath = join(rootDir, entry.name);
      if (entry.isFile() && entry.name === fileName) {
        return entryPath;
      }
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        const found = findFileByName(entryPath, fileName, depth - 1);
        if (found) {
          return found;
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function requestQwenDeviceCode(challenge: string): Promise<DeviceCodeResponse> {
  const body = new URLSearchParams({
    client_id: QWEN_CLIENT_ID,
    scope: QWEN_SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256"
  });

  const response = await fetch(QWEN_DEVICE_CODE_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json"
    },
    body
  });
  const payload = await parseJsonOrText(response);
  if (!response.ok) {
    throw new Error(`Qwen OAuth failed to start: ${payload}`);
  }

  const asObject = payloadAsObject(payload);
  const deviceCode = readString(asObject.device_code);
  const userCode = readString(asObject.user_code);
  const verificationUri = readString(asObject.verification_uri);
  const verificationUriComplete = readOptionalString(asObject.verification_uri_complete);
  const expiresInSec = readNumber(asObject.expires_in);
  const intervalSec = readOptionalNumber(asObject.interval);

  if (!deviceCode || !userCode || !verificationUri || !expiresInSec) {
    throw new Error("Qwen OAuth returned incomplete device authorization payload.");
  }

  return {
    deviceCode,
    userCode,
    verificationUri,
    verificationUriComplete: verificationUriComplete ?? undefined,
    expiresInSec,
    intervalSec: intervalSec ?? undefined
  };
}

async function requestQwenToken(params: {
  grantType: string;
  deviceCode: string;
  verifier: string;
}): Promise<OAuthTokenResponse | "pending" | "slow_down"> {
  const body = new URLSearchParams({
    grant_type: params.grantType,
    client_id: QWEN_CLIENT_ID,
    device_code: params.deviceCode,
    code_verifier: params.verifier
  });

  const response = await fetch(QWEN_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json"
    },
    body
  });
  const payload = await parseJsonOrText(response);
  const asObject = payloadAsObject(payload);

  if (!response.ok) {
    const error = readOptionalString(asObject.error);
    if (error === "authorization_pending") {
      return "pending";
    }
    if (error === "slow_down") {
      return "slow_down";
    }
    const description = readOptionalString(asObject.error_description) || payload;
    throw new Error(`Qwen OAuth token exchange failed: ${description}`);
  }

  const accessToken = readString(asObject.access_token);
  const refreshToken = readOptionalString(asObject.refresh_token);
  const expiresInSec = readNumber(asObject.expires_in);
  if (!accessToken || !expiresInSec) {
    throw new Error("Qwen OAuth token payload is missing required fields.");
  }

  return {
    accessToken,
    refreshToken: refreshToken ?? undefined,
    expiresAtMs: Date.now() + expiresInSec * 1_000
  };
}

async function requestMiniMaxCode(params: {
  baseUrl: string;
  challenge: string;
  state: string;
}): Promise<{ userCode: string; verificationUri: string; expiresAtMs: number; intervalSec?: number }> {
  const response = await fetch(`${params.baseUrl}/oauth/code`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json"
    },
    body: new URLSearchParams({
      response_type: "code",
      client_id: MINIMAX_CLIENT_ID,
      scope: MINIMAX_SCOPE,
      code_challenge: params.challenge,
      code_challenge_method: "S256",
      state: params.state
    })
  });
  const payload = await parseJsonOrText(response);
  if (!response.ok) {
    throw new Error(`MiniMax OAuth failed to start: ${payload}`);
  }

  const asObject = payloadAsObject(payload);
  const userCode = readString(asObject.user_code);
  const verificationUri = readString(asObject.verification_uri);
  const expiresAtMs = readNumber(asObject.expired_in);
  const intervalSec = readOptionalNumber(asObject.interval);
  const state = readString(asObject.state);

  if (!userCode || !verificationUri || !expiresAtMs || !state) {
    throw new Error("MiniMax OAuth returned incomplete authorization payload.");
  }
  if (state !== params.state) {
    throw new Error("MiniMax OAuth state mismatch.");
  }

  return { userCode, verificationUri, expiresAtMs, intervalSec: intervalSec ?? undefined };
}

async function requestMiniMaxToken(params: {
  baseUrl: string;
  userCode: string;
  verifier: string;
}): Promise<OAuthTokenResponse | "pending"> {
  const response = await fetch(`${params.baseUrl}/oauth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:user_code",
      client_id: MINIMAX_CLIENT_ID,
      user_code: params.userCode,
      code_verifier: params.verifier
    })
  });
  const payload = await parseJsonOrText(response);
  const asObject = payloadAsObject(payload);

  if (!response.ok) {
    throw new Error(`MiniMax OAuth token exchange failed: ${payload}`);
  }

  const status = readOptionalString(asObject.status);
  if (status && status !== "success") {
    return "pending";
  }

  const accessToken = readString(asObject.access_token);
  const refreshToken = readOptionalString(asObject.refresh_token);
  const expires = readNumber(asObject.expired_in);
  if (!accessToken || !refreshToken || !expires) {
    throw new Error("MiniMax OAuth token payload is missing required fields.");
  }

  return {
    accessToken,
    refreshToken,
    expiresAtMs: expires
  };
}

async function requestGitHubDeviceCode(): Promise<DeviceCodeResponse> {
  const response = await fetch(GITHUB_DEVICE_CODE_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: GITHUB_COPILOT_CLIENT_ID,
      scope: "read:user"
    })
  });
  const payload = await parseJsonOrText(response);
  if (!response.ok) {
    throw new Error(`GitHub device code request failed: ${payload}`);
  }

  const asObject = payloadAsObject(payload);
  const deviceCode = readString(asObject.device_code);
  const userCode = readString(asObject.user_code);
  const verificationUri = readString(asObject.verification_uri);
  const expiresInSec = readNumber(asObject.expires_in);
  const intervalSec = readOptionalNumber(asObject.interval);
  if (!deviceCode || !userCode || !verificationUri || !expiresInSec) {
    throw new Error("GitHub device code payload is missing required fields.");
  }

  return { deviceCode, userCode, verificationUri, expiresInSec, intervalSec: intervalSec ?? undefined };
}

async function requestGitHubAccessToken(deviceCode: string): Promise<OAuthTokenResponse | "pending" | "slow_down"> {
  const response = await fetch(GITHUB_ACCESS_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: GITHUB_COPILOT_CLIENT_ID,
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code"
    })
  });
  const payload = await parseJsonOrText(response);
  if (!response.ok) {
    throw new Error(`GitHub device token request failed: ${payload}`);
  }

  const asObject = payloadAsObject(payload);
  const accessToken = readOptionalString(asObject.access_token);
  if (accessToken) {
    return { accessToken };
  }

  const error = readOptionalString(asObject.error);
  if (error === "authorization_pending") {
    return "pending";
  }
  if (error === "slow_down") {
    return "slow_down";
  }

  throw new Error(readOptionalString(asObject.error_description) || payload);
}

async function pollUntilToken(params: {
  timeoutMs: number;
  intervalMs: number;
  progress: { update: (message: string) => void; stop: (message?: string) => void };
  waitingMessage: string;
  poll: () => Promise<OAuthTokenResponse | "pending" | "slow_down">;
}): Promise<OAuthTokenResponse> {
  const startedAt = Date.now();
  let waitMs = params.intervalMs;

  while (Date.now() - startedAt < params.timeoutMs) {
    params.progress.update(params.waitingMessage);
    const result = await params.poll();
    if (result === "pending") {
      await sleep(waitMs);
      continue;
    }
    if (result === "slow_down") {
      waitMs = Math.min(10_000, Math.floor(waitMs * 1.5));
      await sleep(waitMs);
      continue;
    }
    return result;
  }

  throw new Error("Authentication timed out waiting for approval.");
}

function generatePkceChallenge(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function generatePkceChallengeWithState(): { verifier: string; challenge: string; state: string } {
  const base = generatePkceChallenge();
  return {
    ...base,
    state: randomBytes(16).toString("base64url")
  };
}

async function openUrlBestEffort(url: string): Promise<void> {
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args =
    process.platform === "win32" ? ["/c", "start", "", url] : [url];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "ignore",
      detached: true
    });
    child.on("error", reject);
    child.on("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

async function parseJsonOrText(response: Response): Promise<string> {
  const text = await response.text();
  try {
    return JSON.stringify(JSON.parse(text) as unknown);
  } catch {
    return text.trim() || response.statusText;
  }
}

function payloadAsObject(payload: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // no-op
  }
  return {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readOptionalString(value: unknown): string | null {
  return readString(value);
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function readOptionalNumber(value: unknown): number | null {
  return readNumber(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
