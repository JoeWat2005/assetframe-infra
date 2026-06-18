import "server-only";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { sql } from "./db";

// API key format: `af_live_` + 32 random bytes, base64url-encoded (no padding).
// Stored as a sha256 hex hash — the key is high-entropy random so sha256 is
// sufficient without bcrypt. The full key is shown to the user exactly once and
// never persisted.

const PREFIX = "af_live_";

function generateRawKey(): string {
  return PREFIX + randomBytes(32).toString("base64url").replace(/=/g, "");
}

export function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function keyPrefixOf(raw: string): string {
  // Display prefix: `af_live_` + first 6 chars of the random part.
  const randomPart = raw.slice(PREFIX.length);
  return PREFIX + randomPart.slice(0, 6);
}

export type ApiKeyRecord = {
  id: string;
  name: string | null;
  key_prefix: string;
  created_at: Date;
  last_used_at: Date | null;
};

export type CreatedApiKey = {
  id: string;
  name: string | null;
  key: string; // Full key — shown once, never stored.
  prefix: string;
  createdAt: Date;
};

export async function createApiKey(
  clerkUserId: string,
  name: string | null
): Promise<CreatedApiKey> {
  if (!sql) throw new Error("Database not configured");
  const id = randomUUID();
  const raw = generateRawKey();
  const hash = hashKey(raw);
  const prefix = keyPrefixOf(raw);
  const rows = await sql`
    INSERT INTO api_keys (id, clerk_user_id, name, key_prefix, key_hash)
    VALUES (${id}, ${clerkUserId}, ${name ?? null}, ${prefix}, ${hash})
    RETURNING created_at
  `;
  const createdAt = (rows as Array<{ created_at: Date }>)[0].created_at;
  return { id, name: name ?? null, key: raw, prefix, createdAt };
}

export async function verifyApiKey(
  raw: string | null | undefined
): Promise<{ clerkUserId: string } | null> {
  if (!raw || !raw.startsWith(PREFIX)) return null;
  if (!sql) return null;
  const hash = hashKey(raw);
  const rows = await sql`
    SELECT clerk_user_id FROM api_keys
    WHERE key_hash = ${hash} AND revoked_at IS NULL
    LIMIT 1
  `;
  const row = (rows as Array<{ clerk_user_id: string }>)[0];
  if (!row) return null;
  // Fire-and-forget last_used_at update — we don't await so the auth path is fast.
  void sql`
    UPDATE api_keys SET last_used_at = now() WHERE key_hash = ${hash}
  `.catch(() => undefined);
  return { clerkUserId: row.clerk_user_id };
}

export async function listApiKeys(clerkUserId: string): Promise<ApiKeyRecord[]> {
  if (!sql) return [];
  const rows = await sql`
    SELECT id, name, key_prefix, created_at, last_used_at
    FROM api_keys
    WHERE clerk_user_id = ${clerkUserId} AND revoked_at IS NULL
    ORDER BY created_at DESC
  `;
  return rows as ApiKeyRecord[];
}

export async function revokeApiKey(clerkUserId: string, id: string): Promise<void> {
  if (!sql) return;
  await sql`
    UPDATE api_keys
    SET revoked_at = now()
    WHERE id = ${id} AND clerk_user_id = ${clerkUserId} AND revoked_at IS NULL
  `;
}
