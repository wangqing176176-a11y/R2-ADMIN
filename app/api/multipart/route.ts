import { NextRequest, NextResponse } from "next/server";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client } from "@/lib/r2";
import { getAuthFromHeaders } from "@/utils/auth";

export const runtime = "edge";

type Action = "create" | "signPart" | "complete" | "abort";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const action = body.action as Action | undefined;
    if (!action) return NextResponse.json({ error: "Missing action" }, { status: 400 });

    const { accountId, accessKeyId, secretAccessKey } = getAuthFromHeaders(req);
    const r2 = getR2Client(accountId, accessKeyId, secretAccessKey);

    if (action === "create") {
      const bucket = body.bucket as string | undefined;
      const key = body.key as string | undefined;
      const contentType = body.contentType as string | undefined;
      if (!bucket || !key) return NextResponse.json({ error: "Missing params" }, { status: 400 });

      const data = await r2.send(new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: contentType }));
      return NextResponse.json({ uploadId: data.UploadId });
    }

    if (action === "signPart") {
      const bucket = body.bucket as string | undefined;
      const key = body.key as string | undefined;
      const uploadId = body.uploadId as string | undefined;
      const partNumber = body.partNumber as number | undefined;
      if (!bucket || !key || !uploadId || !partNumber) return NextResponse.json({ error: "Missing params" }, { status: 400 });

      const command = new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber });
      const url = await getSignedUrl(r2, command, { expiresIn: 3600 });
      return NextResponse.json({ url });
    }

    if (action === "complete") {
      const bucket = body.bucket as string | undefined;
      const key = body.key as string | undefined;
      const uploadId = body.uploadId as string | undefined;
      const parts = body.parts as Array<{ etag: string; partNumber: number }> | undefined;
      if (!bucket || !key || !uploadId || !parts?.length) return NextResponse.json({ error: "Missing params" }, { status: 400 });

      const data = await r2.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: parts.map((p) => ({ ETag: p.etag, PartNumber: p.partNumber })),
          },
        }),
      );
      return NextResponse.json({ ok: true, location: data.Location ?? null });
    }

    if (action === "abort") {
      const bucket = body.bucket as string | undefined;
      const key = body.key as string | undefined;
      const uploadId = body.uploadId as string | undefined;
      if (!bucket || !key || !uploadId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

      await r2.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }));
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
