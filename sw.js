// COI Service Worker：给所有响应补 COOP/COEP/CORP 头以开启多线程wasm；同时离线缓存静态资源与模型
const CACHE = "energy-v2";  // 改版本号强制清旧缓存
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  await clients.claim();
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
})()));
function withCOI(resp) {
  const h = new Headers(resp.headers);
  h.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  h.set("Cross-Origin-Embedder-Policy", "credentialless");
  h.set("Cross-Origin-Resource-Policy", "cross-origin");   // 关键！让 COEP 放行同源 wasm
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
}
async function handle(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const network = fetch(req).then(resp => {
    if (resp.ok) cache.put(req, resp.clone());
    return withCOI(resp);
  }).catch(() => cached ? withCOI(cached) : new Response("offline", { status: 503 }));
  return cached ? withCOI(cached) : network;
}
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(handle(e.request));
});
