import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// control-client reads env at module load, so each case sets env then dynamically imports a fresh copy.
const ORIG = process.env;

describe("control-client", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIG };
    delete process.env.ASSETFRAME_CONTROL_URL;
    delete process.env.ASSETFRAME_CONTROL_TOKEN;
    delete process.env.CF_ACCESS_CLIENT_ID;
    delete process.env.CF_ACCESS_CLIENT_SECRET;
  });
  afterEach(() => {
    process.env = ORIG;
    vi.restoreAllMocks();
  });

  function configure() {
    process.env.ASSETFRAME_CONTROL_URL = "https://engine.example/";
    process.env.ASSETFRAME_CONTROL_TOKEN = "bearer-x";
    process.env.CF_ACCESS_CLIENT_ID = "cf-id";
    process.env.CF_ACCESS_CLIENT_SECRET = "cf-sec";
  }

  it("is disabled (and ineligible) when env is unset", async () => {
    const m = await import("./control-client");
    expect(m.controlConfigured()).toBe(false);
    expect(m.controlEligible("run_scoring")).toBe(false);
  });

  it("is eligible when configured, except for poller-process commands", async () => {
    configure();
    const m = await import("./control-client");
    expect(m.controlConfigured()).toBe(true);
    expect(m.controlEligible("run_scoring")).toBe(true);
    expect(m.controlEligible("restart_poller")).toBe(false);
    expect(m.controlEligible("pull_latest")).toBe(false);
  });

  it("POSTs to /control with the access + bearer headers and returns the job id on 202", async () => {
    configure();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ job_id: "job-7" }), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const m = await import("./control-client");
    const r = await m.boxControl("run_scoring", { foo: 1 });

    expect(r).toEqual({ ok: true, id: "job-7", message: "Sent to the box." });
    const [calledUrl, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe("https://engine.example/control"); // trailing slash stripped
    expect(init.method).toBe("POST");
    const h = init.headers as Record<string, string>;
    expect(h.Authorization).toBe("Bearer bearer-x");
    expect(h["CF-Access-Client-Id"]).toBe("cf-id");
    expect(h["CF-Access-Client-Secret"]).toBe("cf-sec");
    expect(JSON.parse(String(init.body))).toEqual({ command: "run_scoring", args: { foo: 1 } });
  });

  it("returns ok:false on a non-202 so the caller can fall back to Neon", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "nope" }), { status: 400 })));
    const m = await import("./control-client");
    const r = await m.boxControl("run_scoring", {});
    expect(r.ok).toBe(false);
    expect(r.message).toContain("400");
  });
});
