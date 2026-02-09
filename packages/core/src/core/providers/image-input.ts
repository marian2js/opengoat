import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { ProviderRuntimeError } from "./errors.js";
import type { ProviderImageInput } from "./types.js";

const DEFAULT_MAX_IMAGE_COUNT = 8;
const DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const IMAGE_EXTENSION_TO_MEDIA_TYPE: Record<string, string> = {
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".webp": "image/webp"
};

const IMAGE_MEDIA_TYPE_TO_EXTENSION: Record<string, string> = {
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/tiff": "tiff",
  "image/webp": "webp"
};

export interface ResolvedProviderImageInput {
  name?: string;
  mediaType: string;
  base64Data: string;
  sourcePath?: string;
}

export async function resolveProviderImageInputs(params: {
  providerId: string;
  images?: ProviderImageInput[];
  cwd?: string;
  maxCount?: number;
  maxBytesPerImage?: number;
}): Promise<ResolvedProviderImageInput[]> {
  const images = params.images ?? [];
  if (images.length === 0) {
    return [];
  }

  const maxCount = params.maxCount ?? DEFAULT_MAX_IMAGE_COUNT;
  if (images.length > maxCount) {
    throw new ProviderRuntimeError(
      params.providerId,
      `too many images provided (${images.length}); the maximum is ${maxCount}`
    );
  }

  const resolved: ResolvedProviderImageInput[] = [];
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    if (!image || typeof image !== "object") {
      throw new ProviderRuntimeError(params.providerId, `image #${index + 1} is invalid`);
    }

    const name = image.name?.trim() || undefined;
    const explicitMediaType = normalizeMediaType(image.mediaType);
    const inputPath = image.path?.trim();
    const dataUrl = image.dataUrl?.trim();

    if (!inputPath && !dataUrl) {
      throw new ProviderRuntimeError(
        params.providerId,
        `image #${index + 1} must include either "path" or "dataUrl"`
      );
    }

    if (inputPath) {
      const absolutePath = path.isAbsolute(inputPath)
        ? inputPath
        : path.resolve(params.cwd ?? process.cwd(), inputPath);
      const fileStat = await stat(absolutePath).catch(() => null);
      if (!fileStat || !fileStat.isFile()) {
        throw new ProviderRuntimeError(
          params.providerId,
          `image #${index + 1} could not be found at ${absolutePath}`
        );
      }

      const maxBytesPerImage = params.maxBytesPerImage ?? DEFAULT_MAX_IMAGE_BYTES;
      if (fileStat.size > maxBytesPerImage) {
        throw new ProviderRuntimeError(
          params.providerId,
          `image #${index + 1} is too large (${fileStat.size} bytes); max allowed is ${maxBytesPerImage} bytes`
        );
      }

      const mediaType = explicitMediaType || inferMediaTypeFromPath(absolutePath);
      if (!mediaType || !isImageMediaType(mediaType)) {
        throw new ProviderRuntimeError(
          params.providerId,
          `image #${index + 1} has unsupported media type (${mediaType ?? "unknown"})`
        );
      }

      const fileBuffer = await readFile(absolutePath);
      resolved.push({
        name,
        mediaType,
        base64Data: fileBuffer.toString("base64"),
        sourcePath: absolutePath
      });
      continue;
    }

    const parsedDataUrl = parseDataUrl(dataUrl as string);
    if (!parsedDataUrl) {
      throw new ProviderRuntimeError(
        params.providerId,
        `image #${index + 1} contains an invalid data URL`
      );
    }

    const mediaType = explicitMediaType || parsedDataUrl.mediaType;
    if (!mediaType || !isImageMediaType(mediaType)) {
      throw new ProviderRuntimeError(
        params.providerId,
        `image #${index + 1} has unsupported media type (${mediaType ?? "unknown"})`
      );
    }

    const imageBytes = Buffer.from(parsedDataUrl.base64Data, "base64");
    const maxBytesPerImage = params.maxBytesPerImage ?? DEFAULT_MAX_IMAGE_BYTES;
    if (imageBytes.byteLength > maxBytesPerImage) {
      throw new ProviderRuntimeError(
        params.providerId,
        `image #${index + 1} is too large (${imageBytes.byteLength} bytes); max allowed is ${maxBytesPerImage} bytes`
      );
    }

    resolved.push({
      name,
      mediaType,
      base64Data: imageBytes.toString("base64")
    });
  }

  return resolved;
}

export function imageExtensionForMediaType(mediaType: string): string {
  return IMAGE_MEDIA_TYPE_TO_EXTENSION[mediaType.toLowerCase()] ?? "bin";
}

export function renderImagePathContext(imagePaths: string[]): string {
  if (imagePaths.length === 0) {
    return "";
  }

  return [
    "## Attached Images",
    "The user attached image files you can inspect locally:",
    ...imagePaths.map((imagePath, index) => `${index + 1}. ${imagePath}`)
  ].join("\n");
}

function normalizeMediaType(value: string | undefined): string | undefined {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : undefined;
}

function inferMediaTypeFromPath(filePath: string): string | undefined {
  const extension = path.extname(filePath).toLowerCase();
  return IMAGE_EXTENSION_TO_MEDIA_TYPE[extension];
}

function isImageMediaType(mediaType: string): boolean {
  return mediaType.toLowerCase().startsWith("image/");
}

function parseDataUrl(value: string): { mediaType?: string; base64Data: string } | null {
  if (!value.startsWith("data:")) {
    return null;
  }

  const commaIndex = value.indexOf(",");
  if (commaIndex < 0) {
    return null;
  }

  const header = value.slice(5, commaIndex).trim();
  const payload = value.slice(commaIndex + 1).trim();
  if (!payload) {
    return null;
  }

  const headerParts = header.split(";").map((part) => part.trim()).filter(Boolean);
  const mediaType = normalizeMediaType(headerParts[0]);
  const isBase64 = headerParts.some((part) => part.toLowerCase() === "base64");
  if (!isBase64) {
    return null;
  }

  const compactPayload = payload.replace(/\s+/g, "");
  if (!isLikelyBase64(compactPayload)) {
    return null;
  }

  return {
    mediaType,
    base64Data: compactPayload
  };
}

function isLikelyBase64(value: string): boolean {
  if (!value) {
    return false;
  }

  return /^[a-zA-Z0-9+/]+=*$/.test(value);
}
