import { NextRequest, NextResponse } from "next/server";
import { assertAdmin, getBucketById } from "@/lib/cf";

export const runtime = "edge";

type Operation = "move" | "copy" | "delete" | "mkdir" | "moveMany" | "copyMany";

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

    const { bucket: bucketId, sourceKey, sourceKeys, targetKey, targetPrefix, operation } = (await req.json()) as {
      bucket?: string;
      sourceKey?: string;
      sourceKeys?: string[];
      targetKey?: string;
      targetPrefix?: string;
      operation?: Operation;
    };

    if (!bucketId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const op: Operation = operation ?? "move";
    if (op !== "move" && op !== "copy" && op !== "delete" && op !== "mkdir" && op !== "moveMany" && op !== "copyMany")
      return NextResponse.json({ error: "Invalid operation" }, { status: 400 });

    const { bucket } = getBucketById(bucketId);

    if (op === "mkdir") {
      if (!targetKey) return NextResponse.json({ error: "Missing params" }, { status: 400 });
      const key = targetKey.endsWith("/") ? targetKey : `${targetKey}/`;
      // Create a zero-byte "folder marker" object.
      await bucket.put(key, new Uint8Array(0), { httpMetadata: { contentType: "application/x-directory" } });
      return NextResponse.json({ success: true });
    }

    if (op === "moveMany" || op === "copyMany") {
      const keys = (sourceKeys ?? []).filter((k) => typeof k === "string" && k.length > 0);
      if (!keys.length) return NextResponse.json({ error: "Missing params" }, { status: 400 });
      if (!targetPrefix) return NextResponse.json({ error: "Missing params" }, { status: 400 });

      let destPrefix = String(targetPrefix).trim();
      if (destPrefix.startsWith("/")) destPrefix = destPrefix.slice(1);
      if (destPrefix && !destPrefix.endsWith("/")) destPrefix += "/";

      let moved = 0;
      for (const k of keys) {
        const isPrefix = k.endsWith("/");
        if (!isPrefix) {
          const base = k.split("/").pop() || k;
          const dest = `${destPrefix}${base}`;
          await copyObject(bucket, k, dest);
          if (op === "moveMany") await bucket.delete(k);
          moved += 1;
          continue;
        }

        const folderName = k.split("/").filter(Boolean).pop() || "folder";
        const destRoot = `${destPrefix}${folderName}/`;
        const all = await listAllKeysWithPrefix(bucket, k);
        for (const src of all) {
          const dest = destRoot + src.slice(k.length);
          await copyObject(bucket, src, dest);
        }
        if (op === "moveMany") await deleteKeys(bucket, all);
        moved += all.length;
      }

      return NextResponse.json({ success: true, count: moved });
    }

    if (!sourceKey) return NextResponse.json({ error: "Missing params" }, { status: 400 });

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
