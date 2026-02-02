import { NextRequest, NextResponse } from "next/server";
import { assertAdmin, getBucketById } from "@/lib/cf";

export const runtime = "edge";

const parsePositiveInt = (value: string | null, fallback: number) => {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);

    const { searchParams } = new URL(req.url);
    const bucketId = searchParams.get("bucket");
    const prefix = searchParams.get("prefix") ?? "";
    const maxPages = parsePositiveInt(searchParams.get("maxPages"), 10);

    if (!bucketId) return NextResponse.json({ error: "Bucket required" }, { status: 400 });

    const { bucket } = getBucketById(bucketId);

    let pagesScanned = 0;
    let objects = 0;
    let bytes = 0;
    let truncated = false;

    let cursor: string | undefined = undefined;
    for (;;) {
      pagesScanned += 1;
      const res = await bucket.list({ prefix, cursor });
      for (const o of res.objects ?? []) {
        objects += 1;
        bytes += o.size ?? 0;
      }
      if (!res.truncated) break;
      if (pagesScanned >= maxPages) {
        truncated = true;
        break;
      }
      cursor = res.cursor;
      if (!cursor) break;
    }

    return NextResponse.json({ bucket: bucketId, prefix, objects, bytes, pagesScanned, truncated });
  } catch (error: unknown) {
    const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status });
  }
}
