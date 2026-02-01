export type BoundBucket = {
  id: string; // binding name, e.g. R2_BUCKET
  name: string; // display name, e.g. qing-cloud
};

type EnvLike = Record<string, unknown>;

const getRequestContext = (): { env?: EnvLike } | undefined => {
  const sym = Symbol.for("__cloudflare-request-context__");
  return (globalThis as any)?.[sym] as { env?: EnvLike } | undefined;
};

const getEnv = (): EnvLike => {
  // On Cloudflare Pages (next-on-pages), env is available via request context.
  const ctx = getRequestContext();
  if (ctx?.env) return ctx.env;
  // Local dev fallback.
  return (process as any)?.env ?? {};
};

type ParsedBucketMap = {
  list: BoundBucket[];
  byId: Record<string, BoundBucket>;
};

const parseBucketMap = (raw: string | undefined | null): ParsedBucketMap => {
  // Accept either JSON:
  //   {"R2_BUCKET":"qing-cloud","R2_MEDIA":"media"}
  // or CSV:
  //   R2_BUCKET:qing-cloud,R2_MEDIA:media
  const list: BoundBucket[] = [];
  const byId: Record<string, BoundBucket> = {};

  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { list, byId };

  const add = (id: string, name: string) => {
    const b: BoundBucket = { id, name };
    byId[id] = b;
    list.push(b);
  };

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const obj = JSON.parse(trimmed) as Record<string, string>;
    for (const [id, name] of Object.entries(obj)) add(id.trim(), String(name).trim());
    return { list, byId };
  }

  for (const part of trimmed.split(",")) {
    const p = part.trim();
    if (!p) continue;
    const idx = p.indexOf(":");
    if (idx === -1) {
      add(p, p);
      continue;
    }
    add(p.slice(0, idx).trim(), p.slice(idx + 1).trim() || p.slice(0, idx).trim());
  }

  return { list, byId };
};

export const getAdminPassword = (): string | null => {
  const env = getEnv();
  const pw = (env["ADMIN_PASSWORD"] as string | undefined | null) ?? null;
  return pw && String(pw).length ? String(pw) : null;
};

export const assertAdmin = (req: Request) => {
  const required = getAdminPassword();
  if (!required) return;
  const got = req.headers.get("x-admin-password") ?? "";
  if (got !== required) {
    const err = new Error("Unauthorized") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
};

const looksLikeR2Bucket = (v: unknown) => {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.list === "function" && typeof o.get === "function" && typeof o.put === "function";
};

export const listBoundBuckets = (): BoundBucket[] => {
  const env = getEnv();

  const parsed = parseBucketMap(env["R2_BUCKETS"] as string | undefined);
  if (parsed.list.length) return parsed.list;

  // Fallback: discover by enumerating env keys.
  const keys = Array.from(new Set([...(Object.keys(env) ?? []), ...(Reflect.ownKeys(env) as string[])]));
  const buckets: BoundBucket[] = [];
  for (const k of keys) {
    try {
      const v = (env as Record<string, unknown>)[k];
      if (looksLikeR2Bucket(v)) buckets.push({ id: k, name: k });
    } catch {
      // ignore
    }
  }
  return buckets.sort((a, b) => a.name.localeCompare(b.name));
};

export const getBucketById = (bucketId: string) => {
  const env = getEnv();
  const buckets = listBoundBuckets();
  const found = buckets.find((b) => b.id === bucketId || b.name === bucketId);
  if (!found) throw new Error("Unknown bucket binding");
  const bucket = (env as Record<string, any>)[found.id];
  if (!bucket) throw new Error("Bucket binding not configured");
  return { bucket, meta: found };
};
