import { NextRequest, NextResponse } from "next/server";
import { ensureDomParser } from "@/lib/edge-polyfills";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client } from "@/lib/r2";
import { getAuthFromHeaders } from "@/utils/auth";

export const runtime = "edge";

const safeFilename = (name: string) => {
  const cleaned = name.replaceAll("\n", " ").replaceAll("\r", " ").replaceAll('"', "'");
  return cleaned.slice(0, 180) || "download";
};

export async function GET(req: NextRequest) {
  ensureDomParser();
  const { searchParams } = new URL(req.url);
  const bucket = searchParams.get("bucket");
  const key = searchParams.get("key");
  const download = searchParams.get("download") === "1";
  const filename = searchParams.get("filename");

  if (!bucket || !key) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  try {
    const { accountId, accessKeyId, secretAccessKey } = getAuthFromHeaders(req);
    const r2 = getR2Client(accountId, accessKeyId, secretAccessKey);
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(download
        ? {
            ResponseContentDisposition: `attachment; filename="${safeFilename(filename || key.split("/").pop() || "download")}"`,
          }
        : null),
    });
    const url = await getSignedUrl(r2, command, { expiresIn: 3600 });
    return NextResponse.json({ url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
