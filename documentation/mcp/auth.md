# MCP auth (OAuth for Pro)

The four free MCP tools need **no auth**. Only `get_pro_report` is gated, by **Clerk OAuth (the MCP Authorization spec) plus a live Pro subscription**.

## Optional-auth wrapper

`app/api/mcp/route.ts` wraps the handler with:

```ts
experimental_withMcpAuth(
  handler,
  async (_req, token?) => {
    try { return verifyClerkToken(await auth({ acceptsToken: "oauth_token" }), token); }
    catch { return undefined; }
  },
  { required: false }
);
```

- `required: false` -> a request without a token still reaches the free tools.
- When a valid Clerk OAuth token is present, the callback populates `extra.authInfo` (with `extra.userId`) for the tools.
- The try/catch means a Clerk/OAuth misconfiguration returns `undefined` (treated as "no auth") rather than failing the whole server — the free tools never go down.

## Pro gate (inside `get_pro_report`)

1. Read `userId = extra?.authInfo?.extra?.userId`. Absent -> error note telling the user to sign in (OAuth) and pointing to `get_report` for free Snapshots.
2. `userIsPro(userId)` = `clerkClient().users.getUser(userId)` -> lowercased primary email -> `computeEntitlement(publicMetadata, email, ADMIN_EMAILS).subscribed`. The MCP path **cannot** use `getEntitlement()` (no request cookies), so it re-derives the same entitlement directly. Admins are `subscribed` by the comp rule and so can read Pro over MCP.
3. Not subscribed -> error note pointing to `{SITE.url}/pricing`.

`ADMIN_EMAILS` is parsed from env (comma-separated, lowercased) at module load.

## OAuth discovery (RFC metadata)

Two well-known routes let an OAuth-capable MCP client discover Clerk and run the flow:

- **`/.well-known/oauth-protected-resource`** (`app/.well-known/oauth-protected-resource/route.ts`) — `protectedResourceHandlerClerk()` (RFC 9728). Tells clients which authorization server (Clerk) protects `/api/mcp`.
- **`/.well-known/oauth-authorization-server`** (`app/.well-known/oauth-authorization-server/route.ts`) — `authServerMetadataHandlerClerk()` (RFC 8414). Proxies Clerk's `authorize` / `token` / `registration` endpoints.

Both are `force-dynamic` and export `OPTIONS = metadataCorsOptionsRequestHandler()` for CORS preflight. Both use `@clerk/mcp-tools/next`.

**Dynamic Client Registration is enabled**, so MCP clients self-register an OAuth client — nothing to pre-provision.

## End-to-end flow

1. Client connects to `{SITE.url}/api/mcp` (Claude Desktop, Cursor, or any client via `mcp-remote`).
2. On a 401/auth challenge it reads the two `/.well-known/oauth-*` documents and registers via DCR.
3. Calling `get_pro_report` triggers an OAuth sign-in window; the user signs in with the AssetFrame account holding their Pro subscription.
4. The token rides subsequent calls; the server verifies it (`verifyClerkToken`) and checks the subscription. With Pro -> full report text + short-lived Pro PDF link. Without -> a message pointing to `/pricing`.

## Security notes

- The Pro tool is defence-in-depth: even an authenticated non-subscriber gets nothing (the subscription check is separate from auth).
- Signed PDF links are short-lived (~600s); Pro file keys are read server-side only (`getEditionProKeys`, DB-only) and never exposed to free tools or the REST API.
- Token verification failures fall through to "no userId" rather than leaking errors.
- **NOT VERIFIED:** the precise OAuth scopes/claims Clerk issues for MCP (`acceptsToken: "oauth_token"` is used; scope details live in the Clerk dashboard config, not the app code).

## Related docs

- `overview.md`, `tools.md`, `examples.md`.
- `../backend/middleware.md` — entitlement derivation shared with the website.
- `../api/auth.md` — why free REST is open and Pro is gated.
- `../auth/` (owned elsewhere) — Clerk + DCR configuration.
