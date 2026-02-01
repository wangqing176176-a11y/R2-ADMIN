import "@/lib/edge-polyfills";
import { NextRequest, NextResponse } from "next/server";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  type ListObjectsV2CommandOutput,
  S3Client,
} from "@aws-sdk/client-s3";
import { getR2Client } from "@/lib/r2";
import { getAuthFromHeaders } from "@/utils/auth";

export const runtime = "edge";

type Operation = "move" | "copy" | "delete";

const copySourceHeaderValue = (bucket: string, key: string) => {
  return `/${bucket}/${encodeURIComponent(key)}`;
};

const listAllKeysWithPrefix = async (r2: S3Client, bucket: string, prefix: string) => {
  const keys: string[] = [];
  let continuationToken: string | undefined = undefined;

  for (;;) {
    const data: ListObjectsV2CommandOutput = await r2.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const item of data.Contents ?? []) {
      if (item.Key) keys.push(item.Key);
    }

    if (!data.IsTruncated || !data.NextContinuationToken) break;
    continuationToken = data.NextContinuationToken;
  }

  return keys;
};

const deleteKeys = async (r2: S3Client, bucket: string, keys: string[]) => {
  const chunkSize = 1000;
  for (let i = 0; i < keys.length; i += chunkSize) {
    const chunk = keys.slice(i, i + chunkSize);
    if (chunk.length === 1) {
      await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: chunk[0] }));
      continue;
    }
    await r2.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }
};

export async function POST(req: NextRequest) {
  try {
    const { bucket, sourceKey, targetKey, operation } = (await req.json()) as {
      bucket?: string;
      sourceKey?: string;
      targetKey?: string;
      operation?: Operation;
    };

    if (!bucket || !sourceKey) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const op: Operation = operation ?? "move";
    if (op !== "move" && op !== "copy" && op !== "delete") {
      return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
    }

    const { accountId, accessKeyId, secretAccessKey } = getAuthFromHeaders(req);
    const r2 = getR2Client(accountId, accessKeyId, secretAccessKey);

    const isPrefix = sourceKey.endsWith("/");
    if (op === "delete") {
      if (!isPrefix) {
        await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: sourceKey }));
        return NextResponse.json({ success: true, count: 1 });
      }
      const keys = await listAllKeysWithPrefix(r2, bucket, sourceKey);
      await deleteKeys(r2, bucket, keys);
      return NextResponse.json({ success: true, count: keys.length });
    }

    if (!targetKey) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    if (!isPrefix) {
      await r2.send(
        new CopyObjectCommand({
          Bucket: bucket,
          Key: targetKey,
          CopySource: copySourceHeaderValue(bucket, sourceKey),
        }),
      );
      if (op === "move") await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: sourceKey }));
      return NextResponse.json({ success: true, count: 1 });
    }

    const keys = await listAllKeysWithPrefix(r2, bucket, sourceKey);
    const toCopy = keys.filter((k) => k.startsWith(sourceKey));

    for (const k of toCopy) {
      const newKey = targetKey + k.slice(sourceKey.length);
      await r2.send(
        new CopyObjectCommand({
          Bucket: bucket,
          Key: newKey,
          CopySource: copySourceHeaderValue(bucket, k),
        }),
      );
    }

    if (op === "move") await deleteKeys(r2, bucket, toCopy);

    return NextResponse.json({ success: true, count: toCopy.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
