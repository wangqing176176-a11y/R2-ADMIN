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

const getTokenSecret = (): string | null => {
  const env = getEnv();
  const explicit = (env["ADMIN_TOKEN_SECRET"] as string | undefined | null) ?? null;
  if (explicit && String(explicit).length) return String(explicit);
  return getAdminPassword();
};

const b64urlEncode = (bytes: Uint8Array) => {
  let base64: string;
  if (typeof Buffer !== "undefined") base64 = Buffer.from(bytes).toString("base64");
  else {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    // eslint-disable-next-line no-undef
    base64 = btoa(s);
  }
  return base64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

const timingSafeEq = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
};

const signHmac = async (secret: string, message: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return b64urlEncode(new Uint8Array(sig));
};

export const issueAccessToken = async (payload: string, expiresInSeconds = 600) => {
  const secret = getTokenSecret();
  if (!secret) return null;
  const exp = Math.floor(Date.now() / 1000) + Math.max(30, Math.min(24 * 3600, expiresInSeconds));
  const sig = await signHmac(secret, `${payload}\n${exp}`);
  return `${exp}.${sig}`;
};

export const verifyAccessToken = async (payload: string, token: string) => {
  const secret = getTokenSecret();
  if (!secret) return false;
  const [expStr, sig] = token.split(".", 2);
  const exp = expStr ? Number.parseInt(expStr, 10) : NaN;
  if (!Number.isFinite(exp)) return false;
  if (exp < Math.floor(Date.now() / 1000)) return false;
  const expected = await signHmac(secret, `${payload}\n${exp}`);
  return timingSafeEq(expected, sig);
};

export const assertAdminOrToken = async (req: Request, searchParams: URLSearchParams, payload: string) => {
  const required = getAdminPassword();
  if (!required) return;

  const got = req.headers.get("x-admin-password") ?? "";
  if (got === required) return;

  const token = searchParams.get("token") ?? "";
  if (token && (await verifyAccessToken(payload, token))) return;

  const err = new Error("Unauthorized") as Error & { status?: number };
  err.status = 401;
  throw err;
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
  const candidateKeys = keys.filter((k) => /^R2_/.test(k));
  const buckets: BoundBucket[] = [];
  for (const k of candidateKeys) {
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
