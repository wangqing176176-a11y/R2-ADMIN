import { NextRequest, NextResponse } from "next/server";
import { assertAdmin, getBucketById } from "@/lib/cf";

export const runtime = "edge";

// 获取文件列表
export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);

    const { searchParams } = new URL(req.url);
    const bucketId = searchParams.get("bucket");
    const prefix = searchParams.get("prefix") || "";

    if (!bucketId) return NextResponse.json({ error: "Bucket required" }, { status: 400 });

    const { bucket } = getBucketById(bucketId);
    const listed: any = await bucket.list({ prefix, delimiter: "/" });

    const folders = (listed.delimitedPrefixes ?? []).map((p: string) => ({
      name: p.replace(prefix, "").replace(/\/$/, ""),
      key: p,
      type: "folder" as const,
    }));

    const files = (listed.objects ?? []).map((o: any) => ({
      name: String(o.key).replace(prefix, ""),
      key: o.key,
      size: o.size,
      lastModified: o.uploaded,
      type: "file" as const,
    }));

    return NextResponse.json({ items: [...folders, ...files] });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status });
  }
}

// 删除文件
export async function DELETE(req: NextRequest) {
  try {
    assertAdmin(req);

    const { searchParams } = new URL(req.url);
    const bucketId = searchParams.get("bucket");
    const key = searchParams.get("key");

    if (!bucketId || !key) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const { bucket } = getBucketById(bucketId);
    await bucket.delete(key);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status });
  }
}

// 获取上传 URL (POST)
export async function POST(req: NextRequest) {
  try {
    assertAdmin(req);

    const { bucket, key } = (await req.json()) as { bucket?: string; key?: string };
    if (!bucket || !key) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    // The client uses XHR PUT to the returned URL.
    const url = `/api/files?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`;
    return NextResponse.json({ url });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status });
  }
}

// 单文件上传 (PUT)
export async function PUT(req: NextRequest) {
  try {
    assertAdmin(req);

    const { searchParams } = new URL(req.url);
    const bucketId = searchParams.get("bucket");
    const key = searchParams.get("key");
    if (!bucketId || !key) return new Response(JSON.stringify({ error: "Missing params" }), { status: 400 });

    const { bucket } = getBucketById(bucketId);
    const contentType = req.headers.get("content-type") || undefined;

    const result = await bucket.put(key, req.body, {
      httpMetadata: contentType ? { contentType } : undefined,
    });

    const headers = new Headers();
    if (result?.etag) headers.set("ETag", result.etag);
    return new Response(null, { status: 200, headers });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json" } });
  }
}
