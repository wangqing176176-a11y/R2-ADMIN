import { NextRequest, NextResponse } from "next/server";
import { ensureDomParser } from "@/lib/edge-polyfills";
import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "@/lib/r2";
import { getAuthFromHeaders } from "@/utils/auth";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  ensureDomParser();
  try {
    const { accountId, accessKeyId, secretAccessKey } = getAuthFromHeaders(req);
    const r2 = getR2Client(accountId, accessKeyId, secretAccessKey);

    const data = await r2.send(new ListBucketsCommand({}));
    const buckets =
      data.Buckets?.map((b) => ({
        Name: b.Name ?? "",
        CreationDate: b.CreationDate?.toISOString?.() ?? "",
      })) ?? [];

    return NextResponse.json({ buckets });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
