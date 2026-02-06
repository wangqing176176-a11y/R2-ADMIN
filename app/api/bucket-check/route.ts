import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertAdmin } from "@/lib/cf";

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

const isValidBucketName = (name: string) => /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/i.test(name);

const parseS3ErrorCode = (body: string) => {
  const m = body.match(/<Code>([^<]+)<\/Code>/i);
  return m?.[1]?.trim() || "";
};

const hintFromS3Error = (code: string, httpStatus: number) => {
  if (code === "NoSuchBucket") return "桶不存在";
  if (code === "AccessDenied") return "无权限";
  if (code === "InvalidAccessKeyId" || code === "SignatureDoesNotMatch") return "密钥异常";
  if (code) return `S3 错误：${code}`;
  if (httpStatus === 403) return "无权限";
  if (httpStatus === 404) return "桶不存在或对象不存在";
  return `请求失败：${httpStatus}`;
};

export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);

    const { searchParams } = new URL(req.url);
    const bucketName = (searchParams.get("bucketName") ?? "").trim();
    if (!bucketName) return NextResponse.json({ ok: false, hint: "缺少桶名" }, { status: 400 });
    if (!isValidBucketName(bucketName)) return NextResponse.json({ ok: false, hint: "桶名格式不正确" }, { status: 400 });

    const env = getEnv();
    const accountId = String(env["R2_ACCOUNT_ID"] ?? "").trim();
    const accessKeyId = String(env["R2_ACCESS_KEY_ID"] ?? "").trim();
    const secretAccessKey = String(env["R2_SECRET_ACCESS_KEY"] ?? "").trim();
    if (!accountId || !accessKeyId || !secretAccessKey) {
      return NextResponse.json(
        { ok: false, bucketName, hint: "未配置 S3 密钥" },
        { headers: { "cache-control": "no-store" } },
      );
    }

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    // Generate a short-lived presigned URL and make a real request to validate the bucket name.
    // Expected success signal: bucket exists and request is authenticated (typically returns NoSuchKey).
    const checkKey = `.r2admin_bucket_check_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const cmd = new GetObjectCommand({ Bucket: bucketName, Key: checkKey });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 });

    const res = await fetch(url, { headers: { Range: "bytes=0-0" } });
    if (res.ok) {
      return NextResponse.json(
        { ok: true, bucketName, hint: "桶名校验通过", httpStatus: res.status },
        { headers: { "cache-control": "no-store" } },
      );
    }

    const body = await res.text().catch(() => "");
    const code = parseS3ErrorCode(body.slice(0, 4096));
    if (code === "NoSuchKey") {
      return NextResponse.json(
        { ok: true, bucketName, hint: "桶名校验通过", httpStatus: res.status, code },
        { headers: { "cache-control": "no-store" } },
      );
    }

    return NextResponse.json(
      { ok: false, bucketName, hint: hintFromS3Error(code, res.status), httpStatus: res.status, code },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error: unknown) {
    const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, hint: message }, { status, headers: { "cache-control": "no-store" } });
  }
}

