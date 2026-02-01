import { NextRequest, NextResponse } from "next/server";
import { assertAdmin, getBucketById } from "@/lib/cf";

export const runtime = "edge";

type Action = "create" | "signPart" | "complete" | "abort";

export async function POST(req: NextRequest) {
  try {
    assertAdmin(req);

    const body = (await req.json()) as Record<string, unknown>;
    const action = body.action as Action | undefined;
    if (!action) return NextResponse.json({ error: "Missing action" }, { status: 400 });

    const bucketId = body.bucket as string | undefined;
    const key = body.key as string | undefined;

    if (!bucketId || !key) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const { bucket } = getBucketById(bucketId);

    if (action === "create") {
      const contentType = body.contentType as string | undefined;
      const upload = await bucket.createMultipartUpload(key, {
        httpMetadata: contentType ? { contentType } : undefined,
      });
      return NextResponse.json({ uploadId: upload.uploadId });
    }

    if (action === "signPart") {
      const uploadId = body.uploadId as string | undefined;
      const partNumber = body.partNumber as number | undefined;
      if (!uploadId || !partNumber) return NextResponse.json({ error: "Missing params" }, { status: 400 });

      const url = `/api/multipart?bucket=${encodeURIComponent(bucketId)}&key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${encodeURIComponent(
        String(partNumber),
      )}`;
      return NextResponse.json({ url });
    }

    if (action === "complete") {
      const uploadId = body.uploadId as string | undefined;
      const parts = body.parts as Array<{ etag: string; partNumber: number }> | undefined;
      if (!uploadId || !parts?.length) return NextResponse.json({ error: "Missing params" }, { status: 400 });

      const upload = bucket.resumeMultipartUpload(key, uploadId);
      await upload.complete(parts);
      return NextResponse.json({ ok: true });
    }

    if (action === "abort") {
      const uploadId = body.uploadId as string | undefined;
      if (!uploadId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

      const upload = bucket.resumeMultipartUpload(key, uploadId);
      await upload.abort();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status });
  }
}

// 上传分片 (PUT)
export async function PUT(req: NextRequest) {
  try {
    assertAdmin(req);

    const { searchParams } = new URL(req.url);
    const bucketId = searchParams.get("bucket");
    const key = searchParams.get("key");
    const uploadId = searchParams.get("uploadId");
    const partNumberStr = searchParams.get("partNumber");

    const partNumber = partNumberStr ? Number.parseInt(partNumberStr, 10) : NaN;
    if (!bucketId || !key || !uploadId || !Number.isFinite(partNumber) || partNumber <= 0) {
      return new Response(JSON.stringify({ error: "Missing params" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const { bucket } = getBucketById(bucketId);
    const upload = bucket.resumeMultipartUpload(key, uploadId);
    const res = await upload.uploadPart(partNumber, req.body);

    const headers = new Headers();
    if (res?.etag) headers.set("ETag", res.etag);
    return new Response(null, { status: 200, headers });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json" } });
  }
}
