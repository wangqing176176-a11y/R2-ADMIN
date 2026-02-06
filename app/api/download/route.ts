import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertAdmin, issueAccessToken } from "@/lib/cf";

export const runtime = "edge";

type EnvLike = Record<string, unknown>;

const getEnv = (): EnvLike => {
  // On Cloudflare Pages, env is available via request context.
  const sym = Symbol.for("__cloudflare-request-context__");
  const g = globalThis as unknown as Record<symbol, unknown>;
  const ctx = g[sym] as { env?: EnvLike } | undefined;
  if (ctx?.env) return ctx.env;

  // Local dev fallback.
  const p = (globalThis as unknown as { process?: { env?: Record<string, unknown> } }).process;
  return p?.env ?? {};
};

const parseBucketMap = (raw: unknown): Record<string, string> => {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return {};

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, string>;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj)) out[String(k).trim()] = String(v).trim();
      return out;
    } catch {
      return {};
    }
  }

  const out: Record<string, string> = {};
  for (const part of trimmed.split(",")) {
    const p = part.trim();
    if (!p) continue;
    const idx = p.indexOf(":");
    if (idx === -1) {
      out[p] = p;
      continue;
    }
    const id = p.slice(0, idx).trim();
    const name = p.slice(idx + 1).trim() || id;
    out[id] = name;
  }
  return out;
};

const encodeRFC5987ValueChars = (value: string) =>
  encodeURIComponent(value)
    .replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, "%2A");

const buildContentDisposition = (filename: string, kind: "attachment" | "inline") => {
  const safeFallback = filename.replace(/[\/\\"]/g, "_");
  const encoded = encodeRFC5987ValueChars(filename);
  return `${kind}; filename="${safeFallback}"; filename*=UTF-8''${encoded}`;
};

const getBucketNameForS3 = (bucketId: string) => {
  const env = getEnv();
  const explicit = parseBucketMap(env["R2_BUCKET_NAMES"]);
  if (explicit[bucketId]) return explicit[bucketId];

  // Back-compat fallback: if you set display names to real bucket names.
  const fromDisplay = parseBucketMap(env["R2_BUCKETS"]);
  if (fromDisplay[bucketId]) return fromDisplay[bucketId];

  return null;
};

const isValidBucketName = (name: string) => /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/i.test(name);

const maybeGetPresignedUrl = async (opts: {
  bucketId: string;
  key: string;
  download: boolean;
  filename: string;
  bucketNameOverride?: string;
}) => {
  const env = getEnv();
  const accountId = String(env["R2_ACCOUNT_ID"] ?? "").trim();
  const accessKeyId = String(env["R2_ACCESS_KEY_ID"] ?? "").trim();
  const secretAccessKey = String(env["R2_SECRET_ACCESS_KEY"] ?? "").trim();
  if (!accountId || !accessKeyId || !secretAccessKey) return null;

  const bucketNameFromClient = String(opts.bucketNameOverride ?? "").trim();
  const bucketName =
    (bucketNameFromClient && isValidBucketName(bucketNameFromClient) ? bucketNameFromClient : "") || getBucketNameForS3(opts.bucketId);
  if (!bucketName) return null;

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  const cmd = new GetObjectCommand({
    Bucket: bucketName,
    Key: opts.key,
    ...(opts.filename ? { ResponseContentDisposition: buildContentDisposition(opts.filename, opts.download ? "attachment" : "inline") } : {}),
  });

  return await getSignedUrl(s3, cmd, { expiresIn: 24 * 3600 });
};

export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);

    const { searchParams } = new URL(req.url);
    const bucketId = searchParams.get("bucket");
    const bucketName = (searchParams.get("bucketName") ?? "").trim();
    const key = searchParams.get("key");
    const download = searchParams.get("download") === "1";
    const forceProxy = searchParams.get("forceProxy") === "1";
    const filename = searchParams.get("filename") ?? "";

    if (!bucketId || !key) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const presigned = forceProxy
      ? null
      : await maybeGetPresignedUrl({
          bucketId,
          key,
          download,
          filename: filename || key.split("/").pop() || "download",
          bucketNameOverride: bucketName || undefined,
        });

    if (presigned) return NextResponse.json({ url: presigned });

    // Fallback: tokenized proxy URL (no extra creds required)
    const origin = new URL(req.url).origin;
    const payload = `object
${bucketId}
${key}
${download ? "1" : "0"}`;
    const token = await issueAccessToken(payload, 24 * 3600);

    const url = `${origin}/api/object?bucket=${encodeURIComponent(bucketId)}&key=${encodeURIComponent(key)}${download ? "&download=1" : ""}${
      filename ? `&filename=${encodeURIComponent(filename)}` : ""
    }${token ? `&token=${encodeURIComponent(token)}` : ""}`;

    return NextResponse.json({ url });
  } catch (error: unknown) {
    const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status });
  }
}
