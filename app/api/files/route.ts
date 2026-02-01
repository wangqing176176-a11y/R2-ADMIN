import { NextRequest, NextResponse } from "next/server";
import { getR2Client } from "@/lib/r2";
import { getAuthFromHeaders } from "@/utils/auth";
import { 
  ListObjectsV2Command, 
  DeleteObjectCommand, 
  PutObjectCommand 
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const runtime = "edge";

// 获取文件列表
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bucket = searchParams.get("bucket");
  const prefix = searchParams.get("prefix") || "";

  if (!bucket) return NextResponse.json({ error: "Bucket required" }, { status: 400 });

  try {
    const { accountId, accessKeyId, secretAccessKey } = getAuthFromHeaders(req);
    const r2 = getR2Client(accountId, accessKeyId, secretAccessKey);

    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      Delimiter: "/",
    });
    const data = await r2.send(command);
    
    const folders = data.CommonPrefixes?.map(p => ({ 
      name: p.Prefix?.replace(prefix, "").replace("/", "") || "", 
      key: p.Prefix,
      type: "folder" 
    })) || [];

    const files = data.Contents?.filter(c => c.Key !== prefix).map(c => ({
      name: c.Key?.replace(prefix, "") || "",
      key: c.Key,
      size: c.Size,
      lastModified: c.LastModified,
      type: "file"
    })) || [];

    return NextResponse.json({ items: [...folders, ...files] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 删除文件
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bucket = searchParams.get("bucket");
  const key = searchParams.get("key");

  if (!bucket || !key) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  try {
    const { accountId, accessKeyId, secretAccessKey } = getAuthFromHeaders(req);
    const r2 = getR2Client(accountId, accessKeyId, secretAccessKey);
    await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 获取上传预签名 URL (POST)
export async function POST(req: NextRequest) {
  const { bucket, key, contentType } = await req.json();
  if (!bucket || !key) return NextResponse.json({ error: "Missing params" }, { status: 400 });
  const { accountId, accessKeyId, secretAccessKey } = getAuthFromHeaders(req);
  const r2 = getR2Client(accountId, accessKeyId, secretAccessKey);
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  const url = await getSignedUrl(r2, command, { expiresIn: 3600 });
  return NextResponse.json({ url });
}
