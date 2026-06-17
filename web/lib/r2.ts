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
        // Cloudflare R2 rejects presigned URLs that carry the AWS SDK v3 default checksum
        // params (x-amz-checksum-mode / x-amz-sdk-checksum-algorithm) with HTTP 403 — which
        // broke every report preview/thumbnail. Force checksums off so presigned GET/PUT
        // URLs stay R2-compatible. (Verified: boto3 presign without these params returns 200.)
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      })
    : null;

/**
 * Short-lived (120s) presigned URL for a private report object (free or Pro).
 * Credentials never leave the server; the client only ever sees a URL that expires
 * in two minutes. Returns null if R2 isn't configured yet (so the route can 503 cleanly).
 */
export async function signedReportUrl(key: string, expiresIn = 120): Promise<string | null> {
  if (!client || !bucket) return null;
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
}

/**
 * Read a report object's bytes as text (used by the MCP/API tools to return the report's
 * content to an agent). Returns null if R2 isn't configured or the object is missing.
 */
export async function getObjectText(key: string): Promise<string | null> {
  if (!client || !bucket) return null;
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!res.Body) return null;
    return await res.Body.transformToString();
  } catch {
    return null;
  }
}

export const r2Configured = Boolean(client && bucket);
