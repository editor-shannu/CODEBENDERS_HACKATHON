/* Baaki service worker: offline app shell and tutor pages. Never caches the demo route, auth, pay links or any POST. */
const VERSION = "baaki-v1";
const PAGES = ["/home", "/owes", "/students", "/invoices", "/forecast", "/munshi"];
const NEVER = [/^\/api\//, /^\/login/, /^\/pay\//, /^\/join\//, /^\/share/, /^\/onboarding/];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

const cacheable = (url) => url.origin === self.location.origin && !NEVER.some((r) => r.test(url.pathname));
const isPage = (url) => PAGES.some((p) => url.pathname === p || url.pathname.startsWith(p + "/"));
const isAsset = (url) => url.pathname.startsWith("/_next/static/") || /\.(?:woff2?|png|svg|ico|webp|css|js)$/.test(url.pathname) || url.pathname === "/manifest.webmanifest";

async function put(req, res) {
  if (!res || !res.ok || res.type === "opaqueredirect" || res.redirected) return;
  const c = await caches.open(VERSION);
  await c.put(req, res);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!cacheable(url)) return;
  if (req.headers.get("RSC") || url.searchParams.has("_rsc")) return; // client navigations stay live
  if (req.mode === "navigate" && isPage(url)) {
    // network first, cached copy when offline
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        e.waitUntil(put(new Request(url.pathname), res.clone()));
        return res;
      } catch {
        const hit = await caches.match(url.pathname);
        return hit || new Response("<h1>Offline</h1><p>Open this page once online so Baaki can keep a copy.</p>", { status: 503, headers: { "content-type": "text/html" } });
      }
    })());
    return;
  }
  if (isAsset(url)) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      e.waitUntil(put(req, res.clone()));
      return res;
    })());
  }
});

// The page sends the assets it already loaded and the tutor pages, so the first visit is enough to go offline.
self.addEventListener("message", (e) => {
  if (!e.data || e.data.type !== "warm") return;
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    for (const raw of e.data.urls || []) {
      try {
        const url = new URL(raw, self.location.origin);
        if (!cacheable(url)) continue;
        if (isPage(url)) {
          const res = await fetch(url.pathname, { credentials: "include", redirect: "manual" });
          if (res.ok && res.type !== "opaqueredirect") await c.put(new Request(url.pathname), res);
        } else if (isAsset(url) && !(await c.match(url.href))) {
          const res = await fetch(url.href);
          if (res.ok) await c.put(url.href, res);
        }
      } catch { /* offline or blocked: skip */ }
    }
  })());
});
