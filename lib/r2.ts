import { S3Client } from "@aws-sdk/client-s3";

export const getR2Client = (accountId: string, accessKeyId: string, secretAccessKey: string) => {
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
};
