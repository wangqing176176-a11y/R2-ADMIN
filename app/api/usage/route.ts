import { NextRequest, NextResponse } from "next/server";
import { ensureDomParser } from "@/lib/edge-polyfills";
import { ListObjectsV2Command, type ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";
import { getR2Client } from "@/lib/r2";
import { getAuthFromHeaders } from "@/utils/auth";

export const runtime = "edge";

const parsePositiveInt = (value: string | null, fallback: number) => {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export async function GET(req: NextRequest) {
  ensureDomParser();
  const { searchParams } = new URL(req.url);
  const bucket = searchParams.get("bucket");
  const prefix = searchParams.get("prefix") ?? "";
  const maxPages = parsePositiveInt(searchParams.get("maxPages"), 10);

  if (!bucket) return NextResponse.json({ error: "Bucket required" }, { status: 400 });

  try {
    const { accountId, accessKeyId, secretAccessKey } = getAuthFromHeaders(req);
    const r2 = getR2Client(accountId, accessKeyId, secretAccessKey);

    let pagesScanned = 0;
    let continuationToken: string | undefined = undefined;
    let objects = 0;
    let bytes = 0;
    let truncated = false;

    for (;;) {
      pagesScanned += 1;
      const data: ListObjectsV2CommandOutput = await r2.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      for (const item of data.Contents ?? []) {
        objects += 1;
        bytes += item.Size ?? 0;
      }

      if (!data.IsTruncated || !data.NextContinuationToken) break;
      if (pagesScanned >= maxPages) {
        truncated = true;
        break;
      }
      continuationToken = data.NextContinuationToken;
    }

    return NextResponse.json({ bucket, prefix, objects, bytes, pagesScanned, truncated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
