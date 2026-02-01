import { NextRequest, NextResponse } from "next/server";
import { assertAdmin, issueAccessToken } from "@/lib/cf";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);

    const { searchParams } = new URL(req.url);
    const bucket = searchParams.get("bucket");
    const key = searchParams.get("key");
    const download = searchParams.get("download") === "1";
    const filename = searchParams.get("filename");

    if (!bucket || !key) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const origin = new URL(req.url).origin;
    const payload = `object\n${bucket}\n${key}\n${download ? "1" : "0"}`;
    const token = await issueAccessToken(payload, 15 * 60);

    const url = `${origin}/api/object?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}${download ? "&download=1" : ""}${
      filename ? `&filename=${encodeURIComponent(filename)}` : ""
    }${token ? `&token=${encodeURIComponent(token)}` : ""}`;

    return NextResponse.json({ url });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status });
  }
}
