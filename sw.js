/* v31: aset & pustaka dari cache (cepat), halaman utama dicek ke server dulu, data aplikasi selalu dari server */
const V="ctb-v31",C=V+"-app",T="ctb-tiles",SC="ctb-scan";
const SHELL=["./","index.html","app.css?v=31","app.js?v=31","config.js?v=31","manifest.webmanifest","icon-192.png","icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C&&k!==T&&k!==SC&&k!=="ctb-lib").map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
async function trim(name,max){const c=await caches.open(name),k=await c.keys();if(k.length>max)for(const r of k.slice(0,k.length-max))await c.delete(r)}
async function cacheFirst(req,name,key,max){
  const c=await caches.open(name),hit=await c.match(key||req);if(hit)return hit;
  const r=await fetch(req);if(r&&(r.ok||r.type==="opaque")){c.put(key||req,r.clone());if(max&&Math.random()<.05)trim(name,max)}return r}
self.addEventListener("fetch",e=>{
  const req=e.request;if(req.method!=="GET")return;
  const u=new URL(req.url);
  // pustaka CDN & font: cache-first
  if(/^(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.hostname)){e.respondWith(cacheFirst(req,"ctb-lib"));return}
  // ubin citra satelit Esri
  if(u.hostname==="server.arcgisonline.com"&&u.pathname.includes("/tile/")){e.respondWith(cacheFirst(req,T,null,3000));return}
  // gambar scan (URL bertanda tangan berganti tiap sesi → kunci tanpa token)
  if(u.hostname.endsWith(".supabase.co")&&u.pathname.includes("/storage/v1/object/sign/scan/")){e.respondWith(cacheFirst(req,SC,u.origin+u.pathname+"?v="+(u.searchParams.get("v")||""),800));return}
  if(u.origin!==location.origin)return;
  if(req.mode==="navigate"){
    e.respondWith((async()=>{const c=await caches.open(C);
      try{const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),3500);const r=await fetch(new Request(req.url,{cache:"no-cache"}),{signal:ctl.signal});clearTimeout(t);c.put("index.html",r.clone());return r}
      catch(_){return (await c.match("index.html"))||(await c.match("./"))||Response.error()}})());return}
  // file aplikasi berversi (?v=) dan ikon: cache-first
  if(u.search.includes("v=")||/\.(png|webmanifest)$/.test(u.pathname)){e.respondWith(cacheFirst(req,C));return}
  e.respondWith(fetch(req).catch(()=>caches.match(req)));
});
