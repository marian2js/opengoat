export type UrlValidationResult =
  | { valid: true; normalized: string }
  | { valid: false; error: string };

export function validateWebsiteUrl(rawUrl: string): UrlValidationResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, error: "Please enter a URL." };
  }

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { valid: false, error: "That doesn\u2019t look like a valid URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "URL must use http or https." };
  }

  if (!parsed.hostname.trim()) {
    return { valid: false, error: "URL must include a domain name." };
  }

  parsed.hash = "";
  return { valid: true, normalized: parsed.toString() };
}
