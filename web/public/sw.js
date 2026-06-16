/* AssetFrame service worker — Web Push (Task T16).
 * Receives pushes from lib/push.ts (payload: {title, body, data:{url}}), shows a
 * notification, and on click focuses an already-open AssetFrame tab or opens the URL.
 * Intentionally minimal: no offline/caching behaviour, push only. */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "AssetFrame", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "AssetFrame";
  const url = (payload.data && payload.data.url) || "/";
  const options = {
    body: payload.body || "",
    icon: "/logo.png",
    badge: "/logo.png",
    data: { url },
    tag: payload.tag || undefined,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          // Focus an existing AssetFrame tab if one is open.
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client && target !== client.url) {
              try {
                client.navigate(target);
              } catch {
                /* navigation not allowed cross-origin — focus is enough */
              }
            }
            return;
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
      })
  );
});
