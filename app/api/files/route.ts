import { NextRequest, NextResponse } from "next/server";
import { assertAdmin, assertAdminOrToken, getBucketById, issueAccessToken } from "@/lib/cf";

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

    const folderKeys = new Set<string>((listed.delimitedPrefixes ?? []) as string[]);
    const files = (listed.objects ?? [])
      // Hide "folder marker" objects (e.g. `a/` with 0 size) from the file list.
      .filter((o: any) => !(typeof o?.key === "string" && o.key.endsWith("/") && Number(o.size ?? 0) === 0))
      .map((o: any) => ({
        name: String(o.key).replace(prefix, ""),
        key: o.key,
        size: o.size,
        lastModified: o.uploaded,
        type: "file" as const,
      }));

    // If an empty-folder marker exists at this level, it might not appear in delimitedPrefixes consistently.
    // Ensure folder markers show up as folders.
    for (const o of listed.objects ?? []) {
      const k = typeof o?.key === "string" ? (o.key as string) : "";
      const size = Number(o?.size ?? 0);
      if (!k || !k.startsWith(prefix) || !k.endsWith("/") || size !== 0) continue;
      const rest = k.slice(prefix.length);
      // Immediate child folder marker: "name/"
      if (!rest) continue;
      const inner = rest.endsWith("/") ? rest.slice(0, -1) : rest;
      if (!inner || inner.includes("/")) continue;
      if (!folderKeys.has(k)) {
        folderKeys.add(k);
        folders.push({ name: inner, key: k, type: "folder" as const });
      }
    }

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

    // The client uses XHR PUT to the returned URL (cannot attach custom headers).
    const payload = `put\n${bucket}\n${key}`;
    const token = await issueAccessToken(payload, 15 * 60);

    const url = `/api/files?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}${
      token ? `&token=${encodeURIComponent(token)}` : ""
    }`;
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
    const { searchParams } = new URL(req.url);
    const bucketId = searchParams.get("bucket");
    const key = searchParams.get("key");
    if (!bucketId || !key) return new Response(JSON.stringify({ error: "Missing params" }), { status: 400 });

    const payload = `put\n${bucketId}\n${key}`;
    await assertAdminOrToken(req, searchParams, payload);

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
