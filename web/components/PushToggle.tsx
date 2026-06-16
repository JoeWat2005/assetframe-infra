"use client";
import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { saveSubscription, removeSubscription } from "@/lib/push-actions";

// The VAPID public key is public by design (it ships in the page and is sent to the push
// service). When unset, push isn't configured yet, so the toggle renders a disabled
// "not configured" state rather than a broken button.
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

// Standard helper: the applicationServerKey for PushManager.subscribe must be a Uint8Array
// decoded from the URL-safe base64 VAPID public key.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  // Back the view with a plain ArrayBuffer so the type is Uint8Array<ArrayBuffer>, which
  // satisfies applicationServerKey's BufferSource (a SharedArrayBuffer-backed view doesn't).
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

type State = "loading" | "unsupported" | "blocked" | "enabled" | "disabled";

export default function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  // On mount, work out the current state from the existing service-worker subscription.
  useEffect(() => {
    if (!VAPID_PUBLIC_KEY) return; // handled by the not-configured render below
    if (!supported) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const existing = await reg.pushManager.getSubscription();
        if (!cancelled) setState(existing ? "enabled" : "disabled");
      } catch {
        if (!cancelled) setState("disabled");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const enable = async () => {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "disabled");
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const res = await saveSubscription(JSON.parse(JSON.stringify(sub)), ["digest"]);
      if (res.ok) {
        setState("enabled");
      } else {
        setError(res.message || "Could not enable notifications.");
        try {
          await sub.unsubscribe();
        } catch {
          /* best-effort cleanup */
        }
        setState("disabled");
      }
    } catch {
      setError("Could not enable notifications. Please try again.");
      setState("disabled");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removeSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("disabled");
    } catch {
      setError("Could not disable notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // Push not configured for this deployment — tasteful disabled state.
  if (!VAPID_PUBLIC_KEY) {
    return (
      <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-line bg-tile px-3 py-2 text-sm text-muted-foreground">
        <BellOff className="size-4" aria-hidden="true" />
        Push notifications aren&rsquo;t configured yet.
      </div>
    );
  }

  const btn =
    "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition disabled:opacity-50";

  return (
    <div className="mt-3">
      {state === "loading" && (
        <p className="text-sm text-muted-foreground">Checking notification status…</p>
      )}

      {state === "unsupported" && (
        <p className="text-sm text-muted-foreground">
          Your browser doesn&rsquo;t support web push notifications. We&rsquo;ll email you instead.
        </p>
      )}

      {state === "blocked" && (
        <p className="text-sm text-muted-foreground">
          Notifications are blocked in your browser settings. Allow notifications for this site to
          enable push — until then we&rsquo;ll email you.
        </p>
      )}

      {state === "disabled" && (
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className={`${btn} bg-navy text-white hover:bg-navy-700`}
        >
          <Bell className="size-4" aria-hidden="true" />
          {busy ? "Enabling…" : "Enable push notifications"}
        </button>
      )}

      {state === "enabled" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-navy">
            <Bell className="size-4" aria-hidden="true" /> Push notifications are on
          </span>
          <button
            type="button"
            onClick={disable}
            disabled={busy}
            className={`${btn} border border-navy text-navy hover:bg-tile`}
          >
            <BellOff className="size-4" aria-hidden="true" />
            {busy ? "Turning off…" : "Turn off"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-[#b91c1c]">{error}</p>}
    </div>
  );
}
