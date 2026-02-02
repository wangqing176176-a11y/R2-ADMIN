import { NextRequest, NextResponse } from "next/server";
import { assertAdmin, listBoundBuckets } from "@/lib/cf";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);
    const buckets = listBoundBuckets().map((b) => ({ id: b.id, Name: b.name, CreationDate: "" }));
    return NextResponse.json({ buckets });
  } catch (error: unknown) {
    const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status });
  }
}
