// 오프라인 실행용 service worker(design.md §12.3).
// - /pyodide/*: 버전이 고정된 큰 파일이라 캐시 우선(한 번 받으면 다시 받지 않음)
// - 그 밖의 같은 출처 GET: 네트워크 우선, 실패하면 캐시(온라인일 때는 항상 최신)
// 캐시된 응답은 COOP/COEP 헤더도 함께 저장되므로 오프라인에서도 cross-origin isolated가 유지된다.
const PYODIDE_CACHE = "pyrpg-pyodide-314.0.7";
const APP_CACHE = "pyrpg-app-v1";
const PYODIDE_FILES = ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"];

self.addEventListener("install", (event) => {
  const base = new URL("./", self.location).pathname;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PYODIDE_CACHE);
      await cache.addAll(PYODIDE_FILES.map((f) => `${base}pyodide/${f}`));
      await (await caches.open(APP_CACHE)).add(base);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PYODIDE_CACHE, APP_CACHE]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.includes("/pyodide/")) {
    event.respondWith(cacheFirst(req, PYODIDE_CACHE));
  } else {
    event.respondWith(networkFirst(req, APP_CACHE));
  }
});

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await cache.put(req, res.clone());
  return res;
}

async function networkFirst(req, name) {
  const cache = await caches.open(name);
  try {
    const res = await fetch(req);
    if (res.ok) await cache.put(req, res.clone());
    return res;
  } catch (e) {
    // 주소에 ?e2e 같은 쿼리가 붙어도 같은 페이지로 본다
    const hit = (await cache.match(req)) ?? (await cache.match(req, { ignoreSearch: true }));
    if (hit) return hit;
    throw e;
  }
}
