import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

interface DeviceIdentity {
  deviceId: string;
  privateKeyPem: string;
  publicKeyPem: string;
}

interface StoredDeviceIdentity extends DeviceIdentity {
  createdAtMs: number;
  version: 1;
}

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function derivePublicKeyRaw(publicKeyPem: string): Buffer {
  const key = crypto.createPublicKey(publicKeyPem);
  const spki = key.export({ format: "der", type: "spki" });
  const publicKey = Buffer.isBuffer(spki) ? spki : Buffer.from(spki);

  if (
    publicKey.length === ED25519_SPKI_PREFIX.length + 32 &&
    publicKey.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
  ) {
    return publicKey.subarray(ED25519_SPKI_PREFIX.length);
  }

  return publicKey;
}

function fingerprintPublicKey(publicKeyPem: string): string {
  return crypto.createHash("sha256").update(derivePublicKeyRaw(publicKeyPem)).digest("hex");
}

function buildDeviceAuthPayload(params: {
  clientId: string;
  clientMode: string;
  deviceFamily?: string;
  deviceId: string;
  nonce: string;
  platform?: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string;
}): string {
  return [
    "v3",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(","),
    String(params.signedAtMs),
    params.token ?? "",
    params.nonce,
    params.platform?.trim() ?? "",
    params.deviceFamily?.trim() ?? "",
  ].join("|");
}

function generateDeviceIdentity(): DeviceIdentity {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" });
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" });

  return {
    deviceId: fingerprintPublicKey(
      typeof publicKeyPem === "string" ? publicKeyPem : publicKeyPem.toString("utf8"),
    ),
    privateKeyPem:
      typeof privateKeyPem === "string" ? privateKeyPem : privateKeyPem.toString("utf8"),
    publicKeyPem:
      typeof publicKeyPem === "string" ? publicKeyPem : publicKeyPem.toString("utf8"),
  };
}

export async function loadOrCreateDeviceIdentity(pathname: string): Promise<DeviceIdentity> {
  try {
    const raw = await readFile(pathname, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoredDeviceIdentity>;
    if (
      parsed.version === 1 &&
      typeof parsed.deviceId === "string" &&
      typeof parsed.publicKeyPem === "string" &&
      typeof parsed.privateKeyPem === "string"
    ) {
      return {
        deviceId: parsed.deviceId,
        privateKeyPem: parsed.privateKeyPem,
        publicKeyPem: parsed.publicKeyPem,
      };
    }
  } catch {
    // Regenerate on missing or invalid files.
  }

  const identity = generateDeviceIdentity();
  const payload: StoredDeviceIdentity = {
    ...identity,
    createdAtMs: Date.now(),
    version: 1,
  };

  await mkdir(dirname(pathname), { recursive: true, mode: 0o700 });
  await writeFile(pathname, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  return identity;
}

export function publicKeyRawBase64UrlFromPem(publicKeyPem: string): string {
  return base64UrlEncode(derivePublicKeyRaw(publicKeyPem));
}

export function signDevicePayload(privateKeyPem: string, payload: string): string {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  return base64UrlEncode(crypto.sign(null, Buffer.from(payload, "utf8"), privateKey));
}

export async function createSignedGatewayDevice(params: {
  clientId: string;
  clientMode: string;
  deviceFamily?: string;
  identityPath: string;
  nonce: string;
  platform?: string;
  role: "operator";
  scopes: string[];
  token?: string;
}): Promise<{
  device: {
    id: string;
    nonce: string;
    publicKey: string;
    signature: string;
    signedAt: number;
  };
  identity: DeviceIdentity;
}> {
  const identity = await loadOrCreateDeviceIdentity(params.identityPath);
  const signedAtMs = Date.now();
  const payload = buildDeviceAuthPayload({
    clientId: params.clientId,
    clientMode: params.clientMode,
    deviceId: identity.deviceId,
    nonce: params.nonce,
    role: params.role,
    scopes: params.scopes,
    signedAtMs,
    ...(params.deviceFamily ? { deviceFamily: params.deviceFamily } : {}),
    ...(params.platform ? { platform: params.platform } : {}),
    ...(params.token ? { token: params.token } : {}),
  });

  return {
    device: {
      id: identity.deviceId,
      nonce: params.nonce,
      publicKey: publicKeyRawBase64UrlFromPem(identity.publicKeyPem),
      signature: signDevicePayload(identity.privateKeyPem, payload),
      signedAt: signedAtMs,
    },
    identity,
  };
}
