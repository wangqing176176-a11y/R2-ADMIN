import { NextRequest, NextResponse } from "next/server";
import { assertAdmin, listBoundBuckets } from "@/lib/cf";

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

const getBucketNameForS3 = (bucketId: string) => {
  const env = getEnv();
  const explicit = parseBucketMap(env["R2_BUCKET_NAMES"]);
  if (explicit[bucketId]) return explicit[bucketId];

  // Back-compat fallback: if you set display names to real bucket names.
  const fromDisplay = parseBucketMap(env["R2_BUCKETS"]);
  if (fromDisplay[bucketId]) return fromDisplay[bucketId];

  return null;
};

const getTransferModeForBucket = (bucketId: string): "presigned" | "proxy" => {
  const env = getEnv();
  const accountId = String(env["R2_ACCOUNT_ID"] ?? "").trim();
  const accessKeyId = String(env["R2_ACCESS_KEY_ID"] ?? "").trim();
  const secretAccessKey = String(env["R2_SECRET_ACCESS_KEY"] ?? "").trim();
  if (!accountId || !accessKeyId || !secretAccessKey) return "proxy";
  const bucketName = getBucketNameForS3(bucketId);
  if (!bucketName) return "proxy";
  return "presigned";
};

export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);
    const buckets = listBoundBuckets().map((b) => ({
      id: b.id,
      Name: b.name,
      CreationDate: "",
      transferMode: getTransferModeForBucket(b.id),
    }));
    return NextResponse.json({ buckets });
  } catch (error: unknown) {
    const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status });
  }
}
