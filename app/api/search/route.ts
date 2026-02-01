import { NextRequest, NextResponse } from "next/server";
import { assertAdmin, getBucketById } from "@/lib/cf";

export const runtime = "edge";

const json = (status: number, obj: unknown) => NextResponse.json(obj, { status });

export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);

    const { searchParams } = new URL(req.url);
    const bucketId = searchParams.get("bucket");
    const qRaw = searchParams.get("q") ?? "";
    const startCursor = searchParams.get("cursor") ?? undefined;
    const limitRaw = searchParams.get("limit") ?? "200";

    if (!bucketId) return json(400, { error: "Bucket required" });

    const q = qRaw.trim().toLowerCase();
    if (!q) return json(200, { items: [], cursor: null });

    const limit = Math.max(1, Math.min(500, Number.parseInt(limitRaw, 10) || 200));
    const { bucket } = getBucketById(bucketId);

    const items: any[] = [];
    let cursor: string | undefined = startCursor;
    let outCursor: string | null = null;
    let pages = 0;

    // Iterate pages until we have enough matches (cap pages to avoid long scans).
    while (items.length < limit && pages < 25) {
      const res: any = await bucket.list({ cursor, limit: 1000 });
      for (const o of res.objects ?? []) {
        if (items.length >= limit) break;
        const key = String(o.key);
        // Hide folder markers.
        if (key.endsWith("/") && Number(o.size ?? 0) === 0) continue;
        if (!key.toLowerCase().includes(q)) continue;
        items.push({
          name: key.split("/").pop() || key,
          key,
          size: o.size,
          lastModified: o.uploaded,
          type: "file",
        });
      }

      if (!res.truncated) {
        outCursor = null;
        break;
      }

      cursor = res.cursor;
      outCursor = cursor ?? null;
      if (!cursor) break;
      pages += 1;
    }

    return json(200, { items, cursor: outCursor });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    const message = error instanceof Error ? error.message : String(error);
    return json(status, { error: message });
  }
}
