import { createHash, createHmac } from "node:crypto";

type S3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
  forcePathStyle: boolean;
};

const DEFAULT_S3_ENDPOINT = "https://s3.us-east-1.amazonaws.com";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function readConfig(): S3Config {
  const endpoint = process.env.S3_ENDPOINT?.trim() || DEFAULT_S3_ENDPOINT;
  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    region: requiredEnv("S3_REGION"),
    bucket: requiredEnv("S3_BUCKET"),
    accessKeyId: requiredEnv("S3_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("S3_SECRET_ACCESS_KEY"),
    publicBaseUrl: requiredEnv("S3_PUBLIC_BASE_URL").replace(/\/+$/, ""),
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "1",
  };
}

function toHexSha256(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Uint8Array | string, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function encodeObjectKey(key: string): string {
  return key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function getDateParts(now: Date): { amzDate: string; shortDate: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return {
    amzDate: iso,
    shortDate: iso.slice(0, 8),
  };
}

function s3ObjectUrl(config: S3Config, key: string): URL {
  const encodedKey = encodeObjectKey(key);
  const endpointUrl = new URL(config.endpoint);
  if (config.forcePathStyle) {
    return new URL(`/${config.bucket}/${encodedKey}`, endpointUrl);
  }
  return new URL(
    `${endpointUrl.protocol}//${config.bucket}.${endpointUrl.host}/${encodedKey}`
  );
}

function signingKey(config: S3Config, shortDate: string): Buffer {
  const kDate = hmac(`AWS4${config.secretAccessKey}`, shortDate);
  const kRegion = hmac(kDate, config.region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

function authHeaders(
  method: "PUT" | "DELETE",
  url: URL,
  payloadHash: string,
  config: S3Config
): Record<string, string> {
  const now = new Date();
  const { amzDate, shortDate } = getDateParts(now);
  const host = url.host;
  const canonicalUri = url.pathname;
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${shortDate}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    toHexSha256(canonicalRequest),
  ].join("\n");
  const kSigning = signingKey(config, shortDate);
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    authorization,
  };
}

function objectKeyFromPublicUrl(config: S3Config, fileUrl: string): string | null {
  const base = `${config.publicBaseUrl}/`;
  if (!fileUrl.startsWith(base)) return null;
  const encodedKey = fileUrl.slice(base.length);
  if (!encodedKey) return null;
  return decodeURIComponent(encodedKey);
}

export function presignS3PublicUrl(
  fileUrl: string,
  expiresInSeconds = 1200
): string {
  const config = readConfig();
  const key = objectKeyFromPublicUrl(config, fileUrl);
  if (!key) return fileUrl;
  const objectUrl = s3ObjectUrl(config, key);
  const now = new Date();
  const { amzDate, shortDate } = getDateParts(now);
  const scope = `${shortDate}/${config.region}/s3/aws4_request`;
  const signedHeaders = "host";
  objectUrl.searchParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  objectUrl.searchParams.set("X-Amz-Credential", `${config.accessKeyId}/${scope}`);
  objectUrl.searchParams.set("X-Amz-Date", amzDate);
  objectUrl.searchParams.set("X-Amz-Expires", String(Math.max(1, expiresInSeconds)));
  objectUrl.searchParams.set("X-Amz-SignedHeaders", signedHeaders);
  const canonicalRequest = [
    "GET",
    objectUrl.pathname,
    objectUrl.searchParams.toString(),
    `host:${objectUrl.host}\n`,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    toHexSha256(canonicalRequest),
  ].join("\n");
  const signature = createHmac("sha256", signingKey(config, shortDate))
    .update(stringToSign)
    .digest("hex");
  objectUrl.searchParams.set("X-Amz-Signature", signature);
  return objectUrl.toString();
}

export async function uploadFileToS3(input: {
  objectKey: string;
  bytes: Uint8Array;
  contentType?: string;
}): Promise<string> {
  const config = readConfig();
  const url = s3ObjectUrl(config, input.objectKey);
  const payloadHash = toHexSha256(input.bytes);
  const headers = authHeaders("PUT", url, payloadHash, config);
  if (input.contentType?.trim()) headers["content-type"] = input.contentType.trim();
  const res = await fetch(url, {
    method: "PUT",
    headers,
    body: Buffer.from(input.bytes),
  });
  if (!res.ok) {
    throw new Error(`S3 upload failed with status ${res.status}`);
  }
  return `${config.publicBaseUrl}/${encodeObjectKey(input.objectKey)}`;
}

export async function deleteFileFromS3ByPublicUrl(fileUrl: string): Promise<void> {
  const config = readConfig();
  const rawKey = objectKeyFromPublicUrl(config, fileUrl);
  if (!rawKey) return;
  const objectUrl = s3ObjectUrl(config, rawKey);
  const payloadHash = toHexSha256("");
  const headers = authHeaders("DELETE", objectUrl, payloadHash, config);
  const res = await fetch(objectUrl, {
    method: "DELETE",
    headers,
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`S3 delete failed with status ${res.status}`);
  }
}
