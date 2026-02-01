import { NextRequest } from "next/server";
import { assertAdmin, getBucketById } from "@/lib/cf";

export const runtime = "edge";

const safeFilename = (name: string) => {
  const cleaned = name.replaceAll("\n", " ").replaceAll("\r", " ").replaceAll('"', "'");
  return cleaned.slice(0, 180) || "download";
};

export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);

    const { searchParams } = new URL(req.url);
    const bucketId = searchParams.get("bucket");
    const key = searchParams.get("key");
    const download = searchParams.get("download") === "1";
    const filename = searchParams.get("filename");

    if (!bucketId || !key) return new Response(JSON.stringify({ error: "Missing params" }), { status: 400 });

    const { bucket } = getBucketById(bucketId);
    const obj: any = await bucket.get(key);
    if (!obj) return new Response("Not found", { status: 404 });

    const headers = new Headers();
    const contentType = obj.httpMetadata?.contentType;
    if (contentType) headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "no-store");

    if (download) {
      headers.set(
        "Content-Disposition",
        `attachment; filename="${safeFilename(filename || key.split("/").pop() || "download")}"`,
      );
    }

    // obj.body is a ReadableStream
    return new Response(obj.body, { status: 200, headers });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json" } });
  }
}
