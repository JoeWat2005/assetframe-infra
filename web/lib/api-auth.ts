import "server-only";
import { verifyApiKey } from "./api-keys";
import { getEntitlementForUserId } from "./entitlements";
import { apiJson } from "./http";
import { SITE } from "@/site.config";

// Helpers that either return a context object (success) or a Response (failure).
// Route handlers check `instanceof Response` and return it immediately.

function getBearer(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice("bearer ".length).trim() || null;
}

export type ApiKeyContext = {
  clerkUserId: string;
};

/**
 * Verify the Bearer token is a valid, non-revoked API key.
 * Returns { clerkUserId } on success, or a 401 Response on failure.
 */
export async function requireApiKey(
  req: Request
): Promise<ApiKeyContext | Response> {
  const raw = getBearer(req);
  const result = await verifyApiKey(raw);
  if (!result) {
    return apiJson(
      {
        error: "unauthorized",
        message: "Provide a valid API key: Authorization: Bearer af_live_...",
      },
      { status: 401 }
    );
  }
  return result;
}

/**
 * Verify the Bearer token AND that the account has an active Pro subscription.
 * Returns { clerkUserId } on success, or a 401/403 Response on failure.
 */
export async function requireProApiKey(
  req: Request
): Promise<ApiKeyContext | Response> {
  const auth = await requireApiKey(req);
  if (auth instanceof Response) return auth;
  const ent = await getEntitlementForUserId(auth.clerkUserId);
  if (!ent.subscribed && !ent.admin) {
    return apiJson(
      {
        error: "forbidden",
        message: `A Pro subscription is required. Subscribe at ${SITE.url.replace(/\/$/, "")}/pricing.`,
      },
      { status: 403 }
    );
  }
  return auth;
}
