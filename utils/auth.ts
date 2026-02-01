import { NextRequest } from "next/server";

export const getAuthFromHeaders = (req: NextRequest) => {
  const accountId = req.headers.get("x-r2-account-id");
  const accessKeyId = req.headers.get("x-r2-access-key-id");
  const secretAccessKey = req.headers.get("x-r2-secret-access-key");

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2 credentials in headers");
  }

  return { accountId, accessKeyId, secretAccessKey };
};
