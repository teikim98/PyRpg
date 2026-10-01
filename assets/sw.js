// 오프라인 실행용 service worker(design.md §12.3).
// - /pyodide/*: 버전이 고정된 큰 파일이라 캐시 우선(한 번 받으면 다시 받지 않음)
// - 그 밖의 같은 출처 GET: 네트워크 우선, 실패하면 캐시(온라인일 때는 항상 최신)
// - HEAD(이미지 존재 확인): 네트워크가 안 되면 같은 주소의 캐시된 GET 응답으로 답한다
// - 처음 접속에서 service worker가 페이지를 제어하기 전에 받은 파일(번들·폰트·이미지)은 페이지가
//   message로 목록을 보내 오면 캐시에 넣는다(한 번 접속만으로 오프라인 실행)
// 캐시된 응답은 COOP/COEP 헤더도 함께 저장되므로 오프라인에서도 cross-origin isolated가 유지된다.
// - 앱 캐시 이름은 빌드마다 바뀐다(vite.config.ts가 빌드 ID를 넣는다). activate에서 옛 캐시를 지운다
const BUILD_ID = "__PYRPG_BUILD_ID__";
const PYODIDE_CACHE = "pyrpg-pyodide-314.0.7";
const APP_CACHE = `pyrpg-app-${BUILD_ID}`;
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

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "cache-urls" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      for (const u of data.urls) {
        let url;
        try {
          url = new URL(u, self.location.href);
        } catch {
          continue;
        }
        if (url.origin !== self.location.origin || url.pathname.includes("/pyodide/")) continue;
        url.hash = "";
        try {
          if (await cache.match(url.href, { ignoreVary: true })) continue;
          const res = await fetch(url.href);
          if (res.ok) await cache.put(url.href, res);
        } catch {
          // 이 파일만 건너뛴다
        }
      }
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.method === "HEAD") {
    event.respondWith(headFallback(req));
    return;
  }
  if (req.method !== "GET") return;
  if (url.pathname.includes("/pyodide/")) {
    event.respondWith(cacheFirst(req, PYODIDE_CACHE));
  } else {
    event.respondWith(networkFirst(req, APP_CACHE));
  }
});

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req, { ignoreSearch: true, ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await safePut(cache, req, res.clone());
  return res;
}

/** 캐시에 넣지 못해도(용량 부족, 206 부분 응답 등) 받은 응답은 그대로 돌려준다 */
async function safePut(cache, req, res) {
  try {
    await cache.put(req, res);
  } catch {
    // 무시
  }
}

async function headFallback(req) {
  try {
    return await fetch(req);
  } catch (e) {
    const opts = { ignoreMethod: true, ignoreSearch: true, ignoreVary: true };
    const hit = (await caches.match(req, opts)) ?? null;
    if (hit) return new Response(null, { status: hit.status, statusText: hit.statusText, headers: hit.headers });
    throw e;
  }
}

async function networkFirst(req, name) {
  const cache = await caches.open(name);
  try {
    const res = await fetch(req);
    if (res.ok) await safePut(cache, req, res.clone());
    return res;
  } catch (e) {
    // 주소에 ?e2e 같은 쿼리가 붙어도 같은 페이지로 본다
    const hit = (await cache.match(req, { ignoreVary: true })) ?? (await cache.match(req, { ignoreSearch: true, ignoreVary: true }));
    if (hit) return hit;
    throw e;
  }
}
