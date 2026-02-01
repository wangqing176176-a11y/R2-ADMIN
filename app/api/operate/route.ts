import { NextRequest, NextResponse } from "next/server";
import { assertAdmin, getBucketById } from "@/lib/cf";

export const runtime = "edge";

type Operation = "move" | "copy" | "delete";

const listAllKeysWithPrefix = async (bucket: any, prefix: string) => {
  const keys: string[] = [];
  let cursor: string | undefined = undefined;

  for (;;) {
    const res: any = await bucket.list({ prefix, cursor });
    for (const o of res.objects ?? []) keys.push(o.key);
    if (!res.truncated) break;
    cursor = res.cursor;
    if (!cursor) break;
  }

  return keys;
};

const deleteKeys = async (bucket: any, keys: string[]) => {
  const chunkSize = 1000;
  for (let i = 0; i < keys.length; i += chunkSize) {
    const chunk = keys.slice(i, i + chunkSize);
    await bucket.delete(chunk);
  }
};

const copyObject = async (bucket: any, fromKey: string, toKey: string) => {
  const obj = await bucket.get(fromKey);
  if (!obj) throw new Error("Source not found");
  await bucket.put(toKey, obj.body, { httpMetadata: obj.httpMetadata, customMetadata: obj.customMetadata });
};

export async function POST(req: NextRequest) {
  try {
    assertAdmin(req);

    const { bucket: bucketId, sourceKey, targetKey, operation } = (await req.json()) as {
      bucket?: string;
      sourceKey?: string;
      targetKey?: string;
      operation?: Operation;
    };

    if (!bucketId || !sourceKey) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const op: Operation = operation ?? "move";
    if (op !== "move" && op !== "copy" && op !== "delete") return NextResponse.json({ error: "Invalid operation" }, { status: 400 });

    const { bucket } = getBucketById(bucketId);

    const isPrefix = sourceKey.endsWith("/");

    if (op === "delete") {
      if (!isPrefix) {
        await bucket.delete(sourceKey);
        return NextResponse.json({ success: true, count: 1 });
      }
      const keys = await listAllKeysWithPrefix(bucket, sourceKey);
      await deleteKeys(bucket, keys);
      return NextResponse.json({ success: true, count: keys.length });
    }

    if (!targetKey) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    if (!isPrefix) {
      await copyObject(bucket, sourceKey, targetKey);
      if (op === "move") await bucket.delete(sourceKey);
      return NextResponse.json({ success: true, count: 1 });
    }

    const keys = await listAllKeysWithPrefix(bucket, sourceKey);
    const toCopy = keys.filter((k) => k.startsWith(sourceKey));

    for (const k of toCopy) {
      const newKey = targetKey + k.slice(sourceKey.length);
      await copyObject(bucket, k, newKey);
    }

    if (op === "move") await deleteKeys(bucket, toCopy);

    return NextResponse.json({ success: true, count: toCopy.length });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status });
  }
}
