import "server-only";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID;
const bucket = process.env.R2_BUCKET;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

const client =
  accountId && accessKeyId && secretAccessKey
    ? new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      })
    : null;

/**
 * Short-lived (120s) presigned URL for a private report object (free or Pro).
 * Credentials never leave the server; the client only ever sees a URL that expires
 * in two minutes. Returns null if R2 isn't configured yet (so the route can 503 cleanly).
 */
export async function signedReportUrl(key: string): Promise<string | null> {
  if (!client || !bucket) return null;
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: 120,
  });
}

export const r2Configured = Boolean(client && bucket);
