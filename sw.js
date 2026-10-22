/* cache cangkang aplikasi; data selalu dari server */
const C="ctb-v23",SHELL=["./","index.html","app.css?v=23","app.js?v=23","config.js?v=23","manifest.webmanifest","icon-192.png","icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==location.origin)return;
  /* halaman utama selalu dicek ulang ke server agar versi baru langsung terambil */
  const req=e.request.mode==="navigate"?new Request(e.request.url,{cache:"no-cache"}):e.request;
  e.respondWith(fetch(req).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match("index.html"))));
});
