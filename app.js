/* Cek Titik Bangunan SE2026 — aplikasi online multi-kecamatan (Supabase + Leaflet) */
"use strict";
const store = { get(k){try{return localStorage.getItem(k)}catch(e){return null}}, set(k,v){try{localStorage.setItem(k,v)}catch(e){}}, del(k){try{localStorage.removeItem(k)}catch(e){}} };
/* satu kecamatan: Tempeh */
const KEC = { kode: "3508050", nama: "Tempeh", url: CFG.SUPABASE_URL, kunci: CFG.SUPABASE_KEY };
const sb = supabase.createClient(KEC.url, KEC.kunci, { auth: { persistSession: true, detectSessionInUrl: true, flowType: "pkce" } });
const CFGDEF = { kode_kec: KEC.kode, nama_kec: KEC.nama, nama_kab: "Lumajang", target_titik: 0, target_sls: 0 };
const KODE = () => (S.cfg && S.cfg.kode_kec) || KEC.kode;
const NAMA_KEC = () => (S.cfg && S.cfg.nama_kec) || KEC.nama;
const TARGET_TITIK_ = () => +(S.cfg && S.cfg.target_titik) || 0;
const TARGET_SLS_ = () => +(S.cfg && S.cfg.target_sls) || 0;
/* naikkan bersama ?v= di index.html dan nama cache di sw.js setiap rilis */
const VERSI = "38", VERSI_TGL = "26 Okt 2026";
const MOBILE = () => innerWidth < 960;
const S = {
  me: null, view: "beranda", sel: null, scan: "wss", opac: .85, showPts: true, showBatas: true, base: "sat",
  tab: "titik", placing: null, focus: null, draft: null, detail: null, minHead: false, minSheet: MOBILE(),
  theme: "dark", open: {}, q: "",
  cfg: null, ai: {}, sls: {}, slsIds: [], people: {}, corr: {}, temuan: {}, status: {}, scans: {}, pts: {}, geoms: {}, urls: {}
};
{const t=store.get("ctb-theme");if(t==="light"||t==="dark")S.theme=t}

const $ = (s,el=document)=>el.querySelector(s);
const esc = s => String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt = n => (n||0).toLocaleString("id-ID");
const shortNm = n => (n||"").replace(/ DUSUN.*/,"");
const tgl = d => d?new Date(d).toLocaleString("id-ID",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"";
function toast(msg,ms=2800){const t=$("#toast");t.textContent=msg;t.hidden=false;t.classList.remove("show","hide");void t.offsetWidth;t.classList.add("show");clearTimeout(toast._t);toast._t=setTimeout(()=>{t.classList.remove("show");t.classList.add("hide");setTimeout(()=>{t.hidden=true;t.classList.remove("hide")},240)},ms)}
function modal(html,{onOpen}={}){return new Promise(res=>{const w=document.createElement("div");w.className="modal-wrap";w.innerHTML=`<div class="glass solid modal-card" role="dialog" aria-modal="true">${html}</div>`;document.body.appendChild(w);
  requestAnimationFrame(()=>w.classList.add("show"));
  const close=v=>{w.classList.remove("show");w.classList.add("hide");setTimeout(()=>w.remove(),230);res(v)};
  w.onclick=e=>{if(e.target===w)return close(null);const b=e.target.closest("[data-r]");if(b&&!b.disabled)close(b.dataset.r==="ok"?(w._val?w._val():true):null)};
  onOpen&&onOpen(w,close)})}
function confirmBox(title,msg,ok="Ya",danger){return modal(`<h3>${esc(title)}</h3><p class="muted" style="margin:0">${msg}</p><div class="row" style="justify-content:flex-end;gap:8px"><button class="btn btn-sm btn-ghost" data-r="no" type="button">Batal</button><button class="btn btn-sm ${danger?"danger":""}" data-r="ok" type="button">${esc(ok)}</button></div>`)}
const sv=p=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICON = {
  home:sv('<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>'),
  map:sv('<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>'),
  edit:sv('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>'),
  admin:sv('<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>'),
  out:sv('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  plus:sv('<path d="M12 5v14M5 12h14"/>'), minus:sv('<path d="M5 12h14"/>'),
  target:sv('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  sun:sv('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon:sv('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  down:sv('<path d="m6 9 6 6 6-6"/>'),
  layers:sv('<path d="m12 2 10 6-10 6L2 8z"/><path d="m2 16 10 6 10-6"/>'),
  minimize:sv('<path d="M4 14h6v6M20 10h-6V4"/>'),
  install:sv('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>'),
  search:sv('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  refresh:sv('<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>')
};
const small=(ic,px=14)=>ic.replace("<svg",`<svg width="${px}" height="${px}"`);
const JENIS={benar:"Sudah benar",pindah:"Lokasi diperbaiki",tidak_di_peta:"Tidak ada di peta scan",dobel:"Dobel di peta scan",catatan:"Ada kendala / catatan"};
const isOk=c=>!!c&&(c.jenis==="benar"||c.jenis==="pindah");
const isKendala=c=>!!c&&(c.jenis==="tidak_di_peta"||c.jenis==="dobel"||c.jenis==="catatan");
const REV={menunggu:["Tersimpan","p-ok"],disetujui:["Tersimpan","p-ok"],ditolak:["Tersimpan","p-ok"],ok:["Benar","p-ok"]};
const TEM={tanpa_titik:["Nomor tanpa titik","mag","Nomor ada di gambar peta, tetapi tidak ada titik digitalnya"],tidak_di_peta:["Titik tidak di peta","mag","Titik digital ada, tetapi nomornya tidak ditemukan di gambar peta"],dobel:["Nomor dobel di peta","warn","Nomor yang sama ditulis lebih dari sekali di gambar peta"]};

/* ---------- Tema ---------- */
function applyTheme(){document.documentElement.classList.toggle("light",S.theme==="light");document.querySelectorAll('meta[name="theme-color"]').forEach(m=>m.setAttribute("content",S.theme==="light"?"#f7f7f2":"#16211d"));
  document.querySelectorAll(".theme-toggle").forEach(b=>{b.innerHTML=S.theme==="light"?ICON.moon:ICON.sun;const l=S.theme==="light"?"Pakai tema gelap":"Pakai tema terang";b.setAttribute("aria-label",l);b.title=l});
  const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=S.theme==="light"?"#f7f7f2":"#16211d"}
document.addEventListener("click",e=>{if(e.target.closest(".theme-toggle")){S.theme=S.theme==="light"?"dark":"light";store.set("ctb-theme",S.theme);applyTheme();if(map)drawPts()}});
applyTheme();

/* ---------- Pasang aplikasi (PWA) ---------- */
let deferredInstall=null;
addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e});
addEventListener("appinstalled",()=>{store.set("ctb-install-seen","1");toast("Aplikasi terpasang di perangkat ini.")});
if("serviceWorker" in navigator){const had=!!navigator.serviceWorker.controller;
  addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
  navigator.serviceWorker.addEventListener("controllerchange",()=>{if(had)setTimeout(()=>toast("Versi baru aplikasi sudah diunduh. Tutup lalu buka lagi aplikasinya untuk memakainya.",7000),1500)})}
const isStandalone=()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone;
function hideInstall(){const el=$("#install");if(el.hidden)return;el.classList.add("leaving");setTimeout(()=>{el.hidden=true;el.classList.remove("leaving")},240)}
function showInstall(howTo){
  const el=$("#install");el.classList.remove("leaving");el.hidden=false;el.style.animation="none";void el.offsetWidth;el.style.animation="";
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  el.innerHTML=howTo?`
    <div class="row" style="gap:10px;flex-wrap:nowrap"><span class="ic">${ICON.install}</span><div><b>Cara memasang aplikasi</b><div class="muted" style="font-size:11.5px">Sekali pasang, ikonnya muncul di layar utama HP.</div></div></div>
    <ol class="steps">${ios?`<li>Buka halaman ini di <b>Safari</b>.</li><li>Ketuk tombol <b>Bagikan</b> (kotak dengan panah ke atas).</li><li>Pilih <b>Tambah ke Layar Utama</b>, lalu <b>Tambah</b>.</li>`
      :`<li>Buka halaman ini di <b>Chrome</b>.</li><li>Ketuk menu <b>⋮</b> di pojok kanan atas.</li><li>Pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.</li>`}</ol>
    <div class="row" style="justify-content:flex-end"><button class="btn btn-grad btn-sm" type="button" data-ins="close">Mengerti</button></div>`
  :`<div class="row" style="gap:10px;flex-wrap:nowrap"><span class="ic">${ICON.install}</span><div style="min-width:0"><b>Pasang aplikasi di HP?</b><div class="muted" style="font-size:11.5px">Buka lebih cepat dari layar utama dan tampil layar penuh, seperti aplikasi biasa.</div></div></div>
    <div class="row" style="justify-content:flex-end"><button class="btn btn-ghost btn-sm" type="button" data-ins="later">Nanti saja</button><button class="btn btn-grad btn-sm" type="button" data-ins="go">${small(ICON.install)}Pasang</button></div>`;
  el.onclick=e=>{const b=e.target.closest("[data-ins]");if(!b)return;if(b.dataset.ins==="go")return doInstall();store.set("ctb-install-seen","1");hideInstall()};
}
async function doInstall(){
  if(isStandalone()){toast("Aplikasi sudah terpasang.");return}
  if(deferredInstall){deferredInstall.prompt();const r=await deferredInstall.userChoice;deferredInstall=null;store.set("ctb-install-seen","1");hideInstall();if(r.outcome==="accepted")toast("Memasang aplikasi…");return}
  showInstall(true);
}

/* ---------- Data ---------- */
/* ambil semua baris: halaman pertama dulu, sisanya 6 halaman sekaligus (paralel) */
async function fetchAll(build,page=1000){
  const first=await build().range(0,page-1);if(first.error)throw first.error;let out=first.data;if(out.length<page)return out;
  for(let from=page;;from+=6*page){
    const ps=await Promise.all([0,1,2,3,4,5].map(i=>build().range(from+i*page,from+(i+1)*page-1)));let done=false;
    for(const{data,error}of ps){if(error)throw error;out=out.concat(data);if(data.length<page){done=true;break}}
    if(done)return out}}
/* simpanan data di IndexedDB (muat besar, tidak dibatasi 5 MB seperti localStorage) */
const IDB=(()=>{let p;const db=()=>p||(p=new Promise((ok,no)=>{const r=indexedDB.open("ctb",1);r.onupgradeneeded=()=>r.result.createObjectStore("kv");r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}));
  const tx=(m,f)=>db().then(d=>new Promise((ok,no)=>{const t=d.transaction("kv",m),q=f(t.objectStore("kv"));t.oncomplete=()=>ok(q&&q.result);t.onerror=()=>no(t.error)}));
  return{get:k=>tx("readonly",o=>o.get(k)).catch(()=>null),set:(k,v)=>tx("readwrite",o=>o.put(v,k)).catch(()=>{}),del:k=>tx("readwrite",o=>o.delete(k)).catch(()=>{})}})();
const me=()=>S.me;
const isAdmin=()=>!!(S.me&&S.me.admin);
const isPML=()=>S.me&&(S.me.peran==="PML"||S.me.admin);
const nameOf=e=>(S.people[e]&&S.people[e].nama)||e||"—";
const AKSES={"":"—",lihat_desa:"Lihat seluruh desa",edit_desa:"Lihat & edit seluruh desa",lihat_kec:"Lihat seluruh kecamatan",lihat_kec_edit_desa:"Lihat sekecamatan, edit sedesa",edit_kec:"Lihat & edit seluruh kecamatan"};
function isBase(id){const s=S.sls[id];if(!s||!S.me)return false;return s.ppl_email===S.me.email||!!(S.people[s.ppl_email]&&S.people[s.ppl_email].pml_email===S.me.email)}
function myDesa(){if(S._md&&S._md.k===S.slsIds.length)return S._md.v;const v=new Set(S.slsIds.filter(isBase).map(id=>S.sls[id].kddesa));S._md={k:S.slsIds.length,v};return v}
function canEdit(id){if(!S.me)return false;if(isAdmin()||isBase(id))return true;const a=S.me.akses||"";if(a==="edit_kec")return !!S.sls[id];return (a==="edit_desa"||a==="lihat_kec_edit_desa")&&!!S.sls[id]&&myDesa().has(S.sls[id].kddesa)}
function canReview(id){if(isAdmin())return true;const s=S.sls[id];return !!(s&&S.people[s.ppl_email]&&S.people[s.ppl_email].pml_email===S.me.email)}
function corrFromRow(r){return {aid:r.assignment_id,sls:r.idsubsls,no:r.no_bang,ub:r.unique_bang,jenis:r.jenis,lat:r.lat,lng:r.lon,note:r.catatan||"",by:r.oleh_email,at:r.updated_at||r.created_at,review:r.status,rby:r.reviewed_by,jumlah:r.jumlah}}
async function loadAll(){
  const [sls,ppl,kor,tem,st,sc,riw,cfg]=await Promise.all([
    fetchAll(()=>sb.from("sls").select("idsubsls,nmsls,kddesa,nmdesa,ppl_email,n_titik,n_far,berubah_batas,peta_sls").order("idsubsls")),
    fetchAll(()=>sb.from("petugas").select("email,nama,peran,pml_email,admin,akses").order("email")),
    fetchAll(()=>sb.from("koreksi").select("assignment_id,idsubsls,no_bang,jenis,lat,lon,catatan,oleh_email,updated_at,status,jumlah").order("assignment_id")),
    fetchAll(()=>sb.from("temuan").select("id,idsubsls,jenis,no_bang,keterangan,jawaban,dijawab_oleh").order("id")),
    fetchAll(()=>sb.from("sls_status").select("*").order("idsubsls")),
    fetchAll(()=>sb.from("scan").select("key,idsubsls,jenis").order("key")),
    fetchAll(()=>sb.from("riwayat").select("assignment_id,jenis,oleh_email,waktu,digabung_at").order("assignment_id")).catch(()=>[]),
    Promise.resolve(sb.from("pengaturan").select("kode_kec,nama_kec,nama_kab,target_titik,target_sls").maybeSingle()).then(r=>r&&r.data).catch(()=>null)
  ]);
  const d={sls,ppl,kor,tem,st,sc,riw,cfg};applyData(d);
  IDB.set(cacheKey(S.me.email),{v:3,t:Date.now(),me:S.me,d});
}
const cacheKey=email=>"ctb-cache-"+KEC.kode+"-"+email;
async function cacheGet(email){const c=await IDB.get(cacheKey(email));return c&&c.v===3?c:null}
try{Object.keys(localStorage).filter(k=>k.startsWith("ctb-cache-")).forEach(k=>localStorage.removeItem(k))}catch(e){}
function applyData({sls,ppl,kor,tem,st,sc,riw,cfg}){
  S.cfg={...CFGDEF,...(cfg||{})};document.title="Cek Titik Bangunan · "+NAMA_KEC();
  S._ci=null;S._corrVer=(S._corrVer||0)+1;
  S.sls={};sls.forEach(r=>S.sls[r.idsubsls]=r);S.slsIds=sls.map(r=>r.idsubsls);
  S.people={};ppl.forEach(r=>S.people[r.email]=r);
  S.corr={};kor.forEach(r=>(S.corr[r.assignment_id]=corrFromRow(r),S._corrVer=(S._corrVer||0)+1));
  S.riw={};(riw||[]).forEach(r=>S.riw[r.assignment_id]=r);
  S.temuan={};tem.forEach(r=>(S.temuan[r.idsubsls]=S.temuan[r.idsubsls]||[]).push(r));
  S.status={};st.forEach(r=>S.status[r.idsubsls]=r);
  S.scans={};S.scanNote={};sc.forEach(r=>{(S.scans[r.idsubsls]=S.scans[r.idsubsls]||{})[r.jenis]=r.key});
}
function corrOf(s){if(!S._ci||S._ciN!==S._corrVer){S._ci={};for(const c of Object.values(S.corr))(S._ci[c.sls]=S._ci[c.sls]||[]).push(c);S._ciN=S._corrVer}return S._ci[s]||[]}
function slsStat(s){
  const r=S.sls[s]||{},cor=corrOf(s);
  const benar=cor.filter(isOk).length,salah=cor.filter(isKendala).length,pindah=cor.filter(c=>c.jenis==="pindah").length;
  const tem=S.temuan[s]||[],dij=tem.filter(t=>t.jawaban).length,done=!!(S.status[s]&&S.status[s].selesai);
  return {n:r.n_titik||0,benar,salah,pindah,far:r.n_far||0,tem:tem.length,dij,done,
    status:done?["Sudah dicek","p-ok"]:(cor.length||dij?["Sedang dicek","p-info"]:["Belum dicek","p-mute"])};
}
async function loadSlsDetail(id){
  if(!S.pts[id]){
    const rows=await fetchAll(()=>sb.from("titik").select("assignment_id,idsubsls,no_bang,unique_bang,kode_bang,kk,usaha,nama_usaha,lon,lat,far,info,keluarga").eq("idsubsls",id).order("assignment_id"));
    S.pts[id]=rows.map(r=>({id:r.assignment_id,aid:r.assignment_id,sls:id,x:r.lon,y:r.lat,no:r.no_bang||"",kb:r.kode_bang,kk:r.kk,usaha:r.usaha,nu:r.nama_usaha,far:r.far,ub:r.unique_bang||id+"#"+r.no_bang,info:r.info,kel:Array.isArray(r.keluarga)?r.keluarga:null}));
  }
  const ar=petaOf(id);
  for(const kd of new Set([S.sls[id].kddesa,(S.sls[ar]||S.sls[id]).kddesa]))if(!S.geoms["d"+kd]){
    const rows=await fetchAll(()=>sb.from("sls").select("idsubsls,geom").eq("kddesa",kd).order("idsubsls"));
    rows.forEach(r=>S.geoms[r.idsubsls]=r.geom);S.geoms["d"+kd]=true;
  }
  id=ar;
  if(S.scans[id]&&!S.urls[id]){
    const rows=(await sb.from("scan").select("*").eq("idsubsls",id)).data||[];
    S.urls[id]={};
    for(const r of rows){const{data}=await sb.storage.from("scan").createSignedUrl(r.path,6*3600);if(data)S.urls[id][r.jenis]={...r,url:data.signedUrl+"&v="+(Date.parse(r.updated_at)||0)}}
  }
}

/* ---------- Login ---------- */
async function boot(){
  $("#gbtn").onclick=async()=>{const{error}=await sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+location.pathname,queryParams:{prompt:"select_account"}}});if(error)toast("Gagal membuka login Google: "+error.message)};
  const qp=new URLSearchParams(location.search+"&"+location.hash.slice(1)),er=qp.get("error_description")||qp.get("error");
  const {data:{session}}=await sb.auth.getSession();
  if(er&&!session){history.replaceState(null,"",location.pathname);return showLogin(`<b style="color:var(--bad)">Login gagal:</b> ${esc(er.replace(/\+/g," "))}<br>Coba lagi, atau kirim pesan ini ke admin.`)}
  sb.auth.onAuthStateChange((ev,s)=>{if(ev==="SIGNED_IN"&&s&&!S.me)afterLogin(s);if(ev==="SIGNED_OUT"){S.me=null;showLogin()}});
  if(session)await afterLogin(session);else showLogin();
}
function showLogin(msg){$("#boot").hidden=true;$("#app").hidden=true;const lg=$("#login");lg.hidden=false;
  if(msg)$("#loginMsg").innerHTML=msg;const c=lg.firstElementChild;c.classList.remove("a-zoom");void c.offsetWidth;c.classList.add("a-zoom")}
async function afterLogin(session){
  if(S._logging)return;S._logging=true;
  try{
    const email=(session.user.email||"").toLowerCase();
    const cache=await cacheGet(email);
    if(cache&&cache.me&&cache.me.email===email){
      /* buka langsung dari data tersimpan, lalu segarkan dari server di belakang */
      S.me=cache.me;applyData(cache.d);
      const sl=scope();S.sel=store.get("ctb-sel-"+KEC.kode+"-"+email);if(!sl.includes(S.sel))S.sel=sl[0]||null;
      $("#boot").hidden=true;$("#login").hidden=true;const app=$("#app");app.hidden=false;app.classList.add("a-zoom");render(0);
      S._logging=false;bgRefresh(email);return;
    }
    const {data,error}=await sb.from("petugas").select("*").eq("email",email).maybeSingle();
    if(error)throw error;
    if(!data){await sb.auth.signOut();S._logging=false;
      showLogin(`<b style="color:var(--bad)">Email ${esc(email)} belum terdaftar.</b><br>Minta admin (Soma Romadhoni) mendaftarkan atau mengganti email Anda, lalu coba masuk lagi.`);return}
    S.me=data;$("#boot").hidden=false;
    await loadAll();
    const sl=scope();S.sel=store.get("ctb-sel-"+KEC.kode+"-"+email);if(!sl.includes(S.sel))S.sel=sl[0]||null;
    $("#boot").hidden=true;
    const lg=$("#login");if(!lg.hidden){const c=lg.firstElementChild;c.classList.add("a-out-zoom");lg.style.transition="opacity .3s";lg.style.opacity="0";await new Promise(r=>setTimeout(r,280));lg.hidden=true;lg.style.opacity="";c.classList.remove("a-out-zoom")}
    const app=$("#app");app.hidden=false;app.classList.remove("a-out-zoom");app.classList.add("a-zoom");render(0);
    if(!store.get("ctb-install-seen")&&!isStandalone())setTimeout(()=>showInstall(false),1200);
  }catch(e){console.error(e);$("#boot").hidden=true;showLogin(`<b style="color:var(--bad)">Gagal memuat data:</b> ${esc(e.message||e)}`)}
  S._logging=false;
}
async function bgRefresh(email){
  try{
    const {data,error}=await sb.from("petugas").select("*").eq("email",email).maybeSingle();
    if(error)return;
    if(!data){IDB.del(cacheKey(email));await sb.auth.signOut();S.me=null;showLogin(`<b style="color:var(--bad)">Email ${esc(email)} belum terdaftar.</b>`);return}
    S.me=data;await loadAll();
    if(S.view==="peta"){if(map&&S.sel){drawPts();renderSheet();renderHead()}}
    else if(S.view==="beranda"||S.view==="koreksi"){const sc=$("#view .scroll"),y=sc?sc.scrollTop:0;render(0);const n=$("#view .scroll");if(n)n.scrollTop=y}
  }catch(e){console.warn(e)}
}
async function logout(){const app=$("#app");hideInstall();app.classList.remove("a-zoom");app.classList.add("a-out-zoom");await new Promise(r=>setTimeout(r,260));destroyMap();await sb.auth.signOut();S.me=null;app.hidden=true;app.classList.remove("a-out-zoom");showLogin()}
function scope(){return S.slsIds}

/* ---------- Render & navigasi ---------- */
const ORDER=["beranda","peta","koreksi","admin"];
function render(dir){$("#app").classList.toggle("on-peta",S.view==="peta");
  const items=[["beranda","Beranda",ICON.home],["peta","Peta",ICON.map],["koreksi","Koreksi",ICON.edit]];
  if(isAdmin())items.push(["admin","Admin",ICON.admin]);
  const nav=$("#nav"),key=items.map(i=>i[0]).join();
  if(nav.dataset.k!==key){nav.dataset.k=key;nav.innerHTML=`<span class="nav-ind" aria-hidden="true"></span><div class="brand"><div class="logo" style="width:38px;height:38px;border-radius:12px"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg></div></div>`+
    items.map(([k,l,ic])=>`<button type="button" data-v="${k}" class="${S.view===k?"on":""}"><span class="tile t-${k}">${ic}</span><span>${l}</span></button>`).join("")+
    `<button type="button" data-v="keluar"><span class="tile t-keluar">${ICON.out}</span><span>Keluar</span></button>`}
  nav.querySelectorAll("[data-v]").forEach(b=>b.classList.toggle("on",b.dataset.v===S.view));moveInd(true);
  if(S.view!=="peta")destroyMap();
  ({beranda:vBeranda,peta:vPeta,koreksi:vKoreksi,admin:vAdmin})[S.view]();
  const first=$("#view").firstElementChild;
  if(first&&dir)first.classList.add(S.view==="peta"?"a-zoom":(dir<0?"a-inL":"a-inR"));
  applyTheme();
}
/* penanda menu aktif: bergeser (efek pegas) ke tombol yang dipilih */
function moveInd(anim){requestAnimationFrame(()=>{const ind=$(".nav-ind"),b=$("#nav button.on");if(!ind)return;
  if(!b||!b.offsetWidth){ind.classList.remove("ready");return}
  ind.classList.toggle("instant",!anim||!ind.classList.contains("ready"));
  ind.style.width=b.offsetWidth+"px";ind.style.height=b.offsetHeight+"px";ind.style.transform=`translate(${b.offsetLeft}px,${b.offsetTop}px)`;
  void ind.offsetWidth;ind.classList.add("ready");ind.classList.remove("instant")})}
addEventListener("resize",()=>moveInd(false));
if(document.fonts)document.fonts.ready.then(()=>moveInd(false));
function go(v){if(v===S.view)return;
  S.view=v;$("#nav").querySelectorAll("[data-v]").forEach(b=>b.classList.toggle("on",b.dataset.v===v));moveInd(false);
  render(0)}
$("#nav").addEventListener("click",e=>{const b=e.target.closest("button[data-v]");if(!b)return;if(b.dataset.v==="keluar")return confirmBox("Keluar dari aplikasi?","Anda perlu masuk lagi dengan akun Google untuk membuka aplikasi ini.","Keluar",true).then(ok=>ok&&logout());go(b.dataset.v)});
async function refreshAll(){try{await loadAll();S.pts={};S.urls={};toast("Data diperbarui.");render(0)}catch(e){toast("Gagal memuat ulang: "+e.message)}}

/* ---------- Cek otomatis dengan AI (Gemini) — khusus admin; kunci API hanya tersimpan di browser admin ---------- */
const AIK="ctb-gemini",GAPI="https://generativelanguage.googleapis.com/v1beta/";
const aiCfg=()=>{try{return {thr:15,...JSON.parse(store.get(AIK)||"{}")}}catch(e){return {thr:15}}};
const aiSetCfg=c=>store.set(AIK,JSON.stringify(c));
const aiKeyOf=s=>"ctb-ai-"+KEC.kode+"-"+s;
function aiData(s){if(!S.ai)S.ai={};if(S.ai[s]===undefined){try{S.ai[s]=JSON.parse(store.get(aiKeyOf(s))||"null")}catch(e){S.ai[s]=null}}return S.ai[s]}
const nNo=x=>{const d=String(x??"").replace(/\D/g,"");return d?String(+d):""};
const mDist=(a,b)=>Math.hypot((a[0]-b[0])*111320*Math.cos(a[1]*Math.PI/180),(a[1]-b[1])*110540);
const AI_PROMPT=`Gambar ini adalah potongan peta sensus (peta WS/WSS BPS) hasil scan. Petugas menulis NOMOR BANGUNAN dengan tangan (angka 1–4 digit, kadang dilingkari atau diberi titik) di dekat/di dalam gambar bangunan.
Temukan SEMUA nomor bangunan tulisan tangan. Abaikan teks cetak (nama jalan, legenda, judul, kode wilayah, RT/RW, skala, koordinat, angka pada kotak judul) dan coretan yang bukan nomor.
Jawab HANYA JSON array: [{"n":"12","box":[ymin,xmin,ymax,xmax]}], koordinat kotak dinormalkan 0–1000 terhadap gambar ini. Jika angka kurang jelas, tetap tulis tebakan terbaik dan tambahkan "ragu":true. Jika tidak ada nomor, jawab [].`;
async function geminiModels(key){
  const r=await fetch(GAPI+"models?pageSize=200",{headers:{"x-goog-api-key":key}});const j=await r.json();
  if(!r.ok)throw new Error((j.error&&j.error.message)||("HTTP "+r.status));
  return (j.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes("generateContent")&&/gemini/i.test(m.name)&&!/embed|tts|audio|image-gen|live/i.test(m.name))
    .map(m=>({id:m.name,nm:m.displayName||m.name}));
}
/* Free tier: model Pro/Argon biasanya kuotanya 0 → pakai Flash yang stabil */
function pickModel(list){const f=re=>list.find(m=>re.test(m.id));return (f(/\/gemini-3\.5-flash$/)||f(/flash-latest$/)||f(/\/gemini-[\d.]+-flash$/)||f(/flash/)||list[0]||{}).id||""}
const AI_NOTHINK={};/* model yang tidak mendukung thinkingLevel minimal */
async function geminiDetect(cfg,b64){
  const mk=()=>JSON.stringify({contents:[{role:"user",parts:[{inline_data:{mime_type:"image/jpeg",data:b64}},{text:AI_PROMPT}]}],
    generationConfig:{temperature:0,responseMimeType:"application/json",...(AI_NOTHINK[cfg.model]?{}:{thinkingConfig:{thinkingLevel:"minimal"}})}});
  let body=mk();
  for(let att=0;att<6;att++){
    const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),90000);let r,j;
    try{r=await fetch(GAPI+cfg.model+":generateContent",{method:"POST",signal:ctl.signal,headers:{"Content-Type":"application/json","x-goog-api-key":cfg.key},body});j=await r.json().catch(()=>({}))}
    catch(e){clearTimeout(to);if(att<5){aiProg("Gemini tidak menjawab, mencoba lagi…");continue}throw new Error("Gemini tidak menjawab (koneksi/timeout)")}
    clearTimeout(to);
    if(r.status===429){const js=JSON.stringify(j);
      if(/PerDay/.test(js)&&/FreeTier/.test(js))throw new Error(`Kuota harian model ${cfg.model.replace("models/","")} di Free tier habis atau tidak tersedia (model Pro/Argon umumnya tidak ada di Free tier). Pilih gemini-3.5-flash di Admin → Pengecekan AI.`);
      const rd=js.match(/"retryDelay"\s*:\s*"(\d+)/);const w=rd?+rd[1]+1:20*(att+1);
      aiProg(`Batas per menit Gemini tercapai, menunggu ${w} detik…`);await new Promise(x=>setTimeout(x,w*1000));continue}
    if(r.status===503||r.status===500){aiProg("Server Gemini sedang sibuk, mencoba lagi…");await new Promise(x=>setTimeout(x,4000*(att+1)));continue}
    if(r.status===400&&/thinking/i.test(JSON.stringify(j))&&!AI_NOTHINK[cfg.model]){AI_NOTHINK[cfg.model]=1;body=mk();att--;continue}
    if(!r.ok)throw new Error((j.error&&j.error.message)||("HTTP "+r.status));
    const txt=((((j.candidates||[])[0]||{}).content||{}).parts||[]).map(p=>p.text||"").join("").replace(/^```(json)?|```$/gm,"").trim();
    let arr=[];try{arr=JSON.parse(txt||"[]")}catch(e){const m=txt.match(/\[[\s\S]*\]/);arr=m?JSON.parse(m[0]):[]}
    return {arr:Array.isArray(arr)?arr:[],tok:(j.usageMetadata&&j.usageMetadata.totalTokenCount)||0};
  }
  throw new Error("Kuota Gemini habis. Coba lagi nanti.");
}
function aiProg(msg,frac){if(msg)S._aiMsg=msg;if(frac!=null)S._aiFrac=frac;aiProgPaint()}
function aiProgPaint(){const el=$("#aiProg");if(!el||!S._aiBusy)return;el.hidden=false;const sec=Math.round((Date.now()-(S._aiT0||Date.now()))/1000);
  el.querySelector("small").textContent=(S._aiMsg||"Menyiapkan…")+` · ${sec} detik`;el.querySelector("i").style.width=((S._aiFrac||0)*100).toFixed(0)+"%"}
async function loadBitmap(url){const r=await fetch(url,{mode:"cors"});if(!r.ok)throw new Error("Gambar scan gagal dimuat");return createImageBitmap(await r.blob())}
/* baca semua nomor di scan SLS ini → posisi lon/lat */
async function aiRun(s){
  const cfg=aiCfg();if(!cfg.key||!cfg.model){toast("Isi kunci API & model dulu di Admin → Pengecekan AI.",4000);return}
  if(S._aiBusy){toast("Pengecekan AI masih berjalan.");return}
  const ar=petaOf(s);await loadSlsDetail(s);const sc=S.urls[ar]||{};const sheets=["wss","inset"].map(j=>sc[j]).filter(Boolean);
  if(!sheets.length){toast("SLS ini belum punya gambar scan.");return}
  S._aiBusy=s;S._aiT0=Date.now();S._aiMsg="Menyiapkan gambar…";S._aiFrac=0;const tick=setInterval(aiProgPaint,1000);const t0=Date.now();let tok=0,dets=[];
  try{
    const jobs=[];
    for(const r of sheets){const bmp=await loadBitmap(r.url);const W=bmp.width,H=bmp.height,n=Math.max(1,Math.ceil(Math.max(W,H)/1100)),ov=.12;
      const tw=W/n,th=H/n;
      for(let gy=0;gy<n;gy++)for(let gx=0;gx<n;gx++){const x0=Math.max(0,gx*tw-tw*ov),y0=Math.max(0,gy*th-th*ov),x1=Math.min(W,(gx+1)*tw+tw*ov),y1=Math.min(H,(gy+1)*th+th*ov);jobs.push({r,bmp,W,H,x0,y0,x1,y1})}}
    let next=0,fin=0;const one=async J=>{
      const cw=Math.round(J.x1-J.x0),ch=Math.round(J.y1-J.y0),k=Math.min(2,1500/Math.max(cw,ch));
      const cv=document.createElement("canvas");cv.width=Math.round(cw*k);cv.height=Math.round(ch*k);const g=cv.getContext("2d");g.imageSmoothingQuality="high";
      g.drawImage(J.bmp,J.x0,J.y0,cw,ch,0,0,cv.width,cv.height);
      const b64=cv.toDataURL("image/jpeg",.9).split(",")[1];cv.width=cv.height=0;
      const {arr,tok:tk}=await geminiDetect(cfg,b64);tok+=tk;
      for(const d of arr){const no=nNo(d.n),b=d.box||d.box_2d;if(!no||!Array.isArray(b)||b.length<4)continue;
        const px=J.x0+((+b[1]+ +b[3])/2/1000)*cw,py=J.y0+((+b[0]+ +b[2])/2/1000)*ch,u=px/J.W,v=py/J.H,r=J.r;
        const lng=r.tl[0]+(r.tr[0]-r.tl[0])*u+(r.bl[0]-r.tl[0])*v,lat=r.tl[1]+(r.tr[1]-r.tl[1])*u+(r.bl[1]-r.tl[1])*v;
        dets.push({no,lng,lat,ragu:!!d.ragu,src:r.jenis})}
      fin++;aiProg(`Membaca potongan ${fin}/${jobs.length} dengan ${cfg.model.replace("models/","")}…`,fin/jobs.length)};
    aiProg(`Mengirim ${jobs.length} potongan ke ${cfg.model.replace("models/","")}…`,0);
    await Promise.all([0,1,2].map(async()=>{while(next<jobs.length){const J=jobs[next++];await one(J)}}));
    jobs.forEach(J=>J.bmp.close&&J.bmp.close());
    /* gabungkan nomor yang sama di potongan bertumpuk / inset (≤ 6 m) */
    const out=[];for(const d of dets){const o=out.find(x=>x.no===d.no&&mDist([x.lng,x.lat],[d.lng,d.lat])<6);if(o){o.ragu=o.ragu&&d.ragu;if(d.src==="inset"){o.lng=d.lng;o.lat=d.lat;o.src="inset"}}else out.push({...d})}
    const data={at:new Date().toISOString(),model:cfg.model,tok,det:out,sec:Math.round((Date.now()-t0)/1000)};
    S.ai[s]=data;store.set(aiKeyOf(s),JSON.stringify(data));
    toast(`AI selesai: ${out.length} nomor terbaca · ${fmt(tok)} token · ${data.sec} detik.`,4500);
  }catch(e){toast("Cek AI gagal: "+(e.message||e),9000)}
  clearInterval(tick);S._aiBusy=null;if(S.sel===s){drawPts();renderSheet()}
}
/* bandingkan hasil AI dengan titik digital */
function aiCompare(s){
  const A=aiData(s);if(!A)return null;const thr=+aiCfg().thr||15,ar=petaOf(s),mp=geomOf(ar);
  const pts=ptsOf(s),others=S.slsIds.filter(x=>x!==s&&petaOf(x)===ar).flatMap(x=>S.pts[x]||[]);
  const inside=d=>inPoly(d.lng,d.lat,mp);
  const byNo={};A.det.forEach(d=>(byNo[d.no]=byNo[d.no]||[]).push(d));
  const res={cocok:[],jauh:[],hilang:[],tanpa:[],dobel:[]};
  for(const p of pts){const ds=byNo[nNo(p.no)]||[];
    if(!ds.length){res.hilang.push({p});continue}
    let best=null,bd=1e9;for(const d of ds){const m=mDist([p.x,p.y],[d.lng,d.lat]);if(m<bd){bd=m;best=d}}
    (bd<=thr?res.cocok:res.jauh).push({p,d:best,m:bd})}
  const known=new Set([...pts,...others].map(p=>nNo(p.no)));
  for(const [no,ds] of Object.entries(byNo)){const inn=ds.filter(inside);if(!inn.length)continue;
    if(!known.has(no))res.tanpa.push({no,d:inn[0],ragu:inn.every(x=>x.ragu)});
    const far=inn.filter((d,i)=>inn.slice(0,i).every(o=>mDist([o.lng,o.lat],[d.lng,d.lat])>12));
    if(far.length>1)res.dobel.push({no,n:far.length,ds:far})}
  res.tanpa.sort((a,b)=>+a.no-+b.no);res.jauh.sort((a,b)=>b.m-a.m);
  return res;
}
function aiHtml(s){
  const cfg=aiCfg(),A=aiData(s),R=aiCompare(s),busy=S._aiBusy===s;
  const head=`<div class="glass card" style="display:grid;gap:8px;margin-top:8px">
    <div class="row between" style="gap:8px"><div><b>Cek otomatis dengan AI</b><div><small class="muted">${A?`Hasil ${tgl(A.at)} · ${esc(A.model.replace("models/",""))} · ${A.det.length} nomor terbaca · ${fmt(A.tok)} token`:"AI membaca nomor tulisan tangan di scan lalu membandingkannya dengan titik digital. Hasilnya hanya usulan."}</small></div></div>
      <button class="btn btn-grad btn-sm" id="aiGo" type="button"${busy||!cfg.key?" disabled":""}>${busy?"Berjalan…":A?"Ulangi":"Mulai cek"}</button></div>
    ${cfg.key?"":`<small style="color:var(--warn)">Kunci API Gemini belum diisi. Buka Admin → Pengecekan AI.</small>`}
    <div id="aiProg" ${busy?"":"hidden"}><div class="prog"><i style="width:${((S._aiFrac||0)*100).toFixed(0)}%"></i></div><small class="muted">${esc(S._aiMsg||"Menyiapkan…")}</small></div></div>`;
  if(!R)return head;
  const sec=(k,title,sub,items,row,bulk)=>items.length?`<div class="ai-sec"><div class="row between"><b>${title} <span class="pill p-mute">${items.length}</span></b>${bulk||""}</div><small class="muted">${sub}</small><div class="list">${items.map(row).join("")}</div></div>`:"";
  const no=x=>`<span class="no">${esc(x)}</span>`,done=p=>{const c=S.corr[p.id];return c?`<span class="pill ${isOk(c)?"p-ok":"p-mag"}">${esc(jenisTxt(c))}</span>`:""};
  return head+`<div class="ai-res">
    ${sec("jauh","Berjauhan dari tulisan di scan",`Jarak lebih dari ${aiCfg().thr} m. Titik biru = digital, titik toska = posisi nomor di scan.`,R.jauh,x=>`<div class="li ai-li">${no(+x.p.no)}<span class="txt"><b>${fmt(Math.round(x.m))} m</b><small>${esc(ptTitle(x.p,""))}</small></span>${done(x.p)}<span class="ai-acts"><button class="btn btn-ghost btn-sm" data-aigo="${esc(x.p.id)}" type="button">Lihat</button><button class="btn btn-grad btn-sm" data-aimv="${esc(x.p.id)}" type="button">Pakai lokasi AI</button></span></div>`)}
    ${sec("hilang","Tidak terbaca / tidak ada di scan","Nomor titik ini tidak ditemukan AI di gambar. Cek dulu di peta — bisa jadi tulisannya tidak terbaca.",R.hilang,x=>`<div class="li ai-li">${no(+x.p.no)}<span class="txt"><small>${esc(ptTitle(x.p,""))}</small></span>${done(x.p)}<span class="ai-acts"><button class="btn btn-ghost btn-sm" data-aigo="${esc(x.p.id)}" type="button">Lihat</button><button class="btn btn-ghost btn-sm" data-aitd="${esc(x.p.id)}" type="button">Tandai tidak ada</button></span></div>`)}
    ${sec("tanpa","Nomor di scan tanpa titik digital","Ada tulisannya di scan (di dalam batas SLS), tapi tidak ada titik dengan nomor itu.",R.tanpa,x=>`<div class="li ai-li">${no(x.no)}<span class="txt"><small>${x.ragu?"AI ragu membaca angka ini":"terbaca jelas"}</small></span><span class="ai-acts"><button class="btn btn-ghost btn-sm" data-aill="${x.d.lat},${x.d.lng}" type="button">Lihat</button></span></div>`,`<button class="btn btn-grad btn-sm" id="aiTanpa" type="button">Jadikan temuan</button>`)}
    ${sec("dobel","Nomor tertulis lebih dari sekali","Nomor yang sama ditulis di beberapa tempat berbeda.",R.dobel,x=>`<div class="li ai-li">${no(x.no)}<span class="txt"><b>${x.n}× di scan</b></span><span class="ai-acts"><button class="btn btn-ghost btn-sm" data-aill="${x.ds[0].lat},${x.ds[0].lng}" type="button">Lihat</button>${ptsOf(s).some(p=>nNo(p.no)===x.no)?`<button class="btn btn-ghost btn-sm" data-aidb="${x.no}|${x.n}" type="button">Tandai dobel</button>`:""}</span></div>`)}
    ${R.cocok.length?`<div class="ai-sec"><div class="row between"><b>Cocok <span class="pill p-ok">${R.cocok.length}</span></b><button class="btn btn-ghost btn-sm" id="aiOk" type="button">Tandai yang cocok ✓ benar</button></div><small class="muted">Nomor di scan berada ≤ ${aiCfg().thr} m dari titik digitalnya.</small></div>`:""}
  </div>`;
}
function bindAi(s){
  const sh=$("#sheet");if(!sh)return;const go=$("#aiGo");if(go)go.onclick=()=>{aiRun(s);renderSheet()};
  const fly=(lat,lng)=>{if(MOBILE())toggleSheet(true);map.flyTo([lat,lng],Math.max(map.getZoom(),19),{duration:.6})};
  sh.querySelectorAll("[data-aigo]").forEach(b=>b.onclick=()=>{const p=ptById(b.dataset.aigo);fly(p.y,p.x);map.once("moveend",()=>openPop(p))});
  sh.querySelectorAll("[data-aill]").forEach(b=>b.onclick=()=>{const[a,c]=b.dataset.aill.split(",").map(Number);fly(a,c)});
  const R=aiCompare(s);if(!R)return;
  sh.querySelectorAll("[data-aimv]").forEach(b=>b.onclick=async()=>{const x=R.jauh.find(y=>y.p.id===b.dataset.aimv);b.disabled=true;
    await save(x.p,{jenis:"pindah",lat:x.d.lat,lng:x.d.lng,note:"Lokasi dari cek AI (scan)"},{silent:true})});
  sh.querySelectorAll("[data-aitd]").forEach(b=>b.onclick=async()=>{const p=ptById(b.dataset.aitd);b.disabled=true;
    await save(p,{jenis:"tidak_di_peta",note:"Nomor tidak ditemukan di scan (cek AI)"},{silent:true})});
  sh.querySelectorAll("[data-aidb]").forEach(b=>b.onclick=async()=>{const[no,n]=b.dataset.aidb.split("|");b.disabled=true;
    for(const p of ptsOf(s).filter(p=>nNo(p.no)===no))await save(p,{jenis:"dobel",jumlah:+n,note:`Tertulis ${n}× di scan (cek AI)`},{silent:true})});
  const tb=$("#aiTanpa");if(tb)tb.onclick=async()=>{
    if(!await confirmBox("Jadikan temuan?",`${R.tanpa.length} nomor (${esc(R.tanpa.map(x=>x.no).join(", "))}) masuk ke Temuan admin. PPL diminta mengecek dan menjawab.`,"Ya, jadikan temuan"))return;
    tb.disabled=true;const rows=R.tanpa.map(x=>({idsubsls:s,jenis:"tanpa_titik",no_bang:String(+x.no).padStart(4,"0"),keterangan:"Cek AI: nomor ada di scan, titik digital tidak ada"+(x.ragu?" (AI ragu membaca angkanya)":"")}));
    const{error}=await sb.from("temuan").upsert(rows,{onConflict:"idsubsls,jenis,no_bang",ignoreDuplicates:true});
    if(error){toast("Gagal: "+error.message);tb.disabled=false;return}
    const{data}=await sb.from("temuan").select("id,idsubsls,jenis,no_bang,keterangan,jawaban,dijawab_oleh").eq("idsubsls",s).order("id");S.temuan[s]=data||S.temuan[s];
    toast(`${rows.length} nomor masuk Temuan admin.`);renderSheet()};
  const ok=$("#aiOk");if(ok)ok.onclick=async()=>{const todo=R.cocok.filter(x=>!S.corr[x.p.id]);
    if(!todo.length){toast("Semua titik yang cocok sudah punya status.");return}
    if(!await confirmBox("Tandai sudah benar?",`${todo.length} titik yang posisinya cocok dengan tulisan di scan akan ditandai <b>Sudah benar</b>. Titik yang sudah punya status tidak diubah.`,"Ya, tandai"))return;
    ok.disabled=true;const rows=todo.map(({p})=>({assignment_id:p.id,idsubsls:p.sls,no_bang:p.no,unique_bang:p.ub,jenis:"benar",lon:null,lat:null,catatan:null,oleh_email:S.me.email,status:"ok"}));
    for(let i=0;i<rows.length;i+=500){const{data,error}=await sb.from("koreksi").upsert(rows.slice(i,i+500),{onConflict:"assignment_id"}).select();if(error){toast("Gagal: "+error.message);return}data.forEach(r=>(S.corr[r.assignment_id]=corrFromRow(r),S._corrVer=(S._corrVer||0)+1))}
    await syncDone(s);drawPts();renderSheet();toast(`${rows.length} titik ditandai sudah benar.`)};
}
/* lapisan peta: posisi nomor hasil AI + garis ke titik yang berjauhan */
function drawAi(){
  if(!map)return;if(window.L_ai){L_ai.remove();window.L_ai=null}
  if(S.tab!=="ai"||!isAdmin())return;const R=aiCompare(S.sel),A=aiData(S.sel);if(!R)return;
  const g=window.L_ai=L.layerGroup();
  A.det.forEach(d=>L.circleMarker([d.lat,d.lng],{radius:4,color:"#0b3b3a",weight:1.5,fillColor:"#22e3d6",fillOpacity:1,interactive:false})
    .bindTooltip(d.no+(d.ragu?"?":""),{permanent:true,direction:"left",offset:[-5,0],className:"nb ai"}).addTo(g));
  R.jauh.forEach(x=>L.polyline([[x.p.y,x.p.x],[x.d.lat,x.d.lng]],{color:"#22e3d6",weight:2,dashArray:"4 5",interactive:false}).addTo(g));
  g.addTo(map);
}
/* pengaturan di menu Admin */
function renderAiCfg(){
  const box=$("#aiBox");if(!box)return;const c=aiCfg();
  box.innerHTML=`<div class="peng-grid">
      <label><small class="muted">Kunci API Gemini (dari aistudio.google.com)</small><input class="field mono" id="aiKey" type="password" autocomplete="off" placeholder="${c.key?"tersimpan ••••"+esc(c.key.slice(-4)):"AIza…"}"></label>
      <label><small class="muted">Model (Free tier: pakai gemini-3.5-flash; Argon/Pro butuh billing)</small><select class="field" id="aiModel">${c.model?`<option value="${esc(c.model)}">${esc(c.model.replace("models/",""))}</option>`:`<option value="">— muat daftar model dulu —</option>`}</select></label>
      <label><small class="muted">Batas jarak "cocok" (meter)</small><input class="field mono" id="aiThr" inputmode="numeric" value="${c.thr||15}"></label>
    </div>
    <div class="row between" style="gap:8px"><small class="muted">Kunci hanya disimpan di browser ini (tidak dikirim ke database, tidak terlihat petugas lain). Gambar scan dikirim langsung dari browser ini ke Google Gemini.</small>
      <div class="row" style="gap:6px">${c.key?`<button class="btn btn-bad btn-sm" id="aiDel" type="button">Hapus kunci</button>`:""}<button class="btn btn-ghost btn-sm" id="aiList" type="button">Muat daftar model</button><button class="btn btn-grad btn-sm" id="aiSave" type="button">Simpan</button></div></div>`;
  const keyNow=()=>$("#aiKey").value.trim()||aiCfg().key||"";
  $("#aiList").onclick=async e=>{const k=keyNow();if(!k){toast("Tempel kunci API dulu.");return}e.currentTarget.disabled=true;
    try{const ls=await geminiModels(k),pick=c.model&&ls.some(m=>m.id===c.model)?c.model:pickModel(ls);
      $("#aiModel").innerHTML=ls.map(m=>`<option value="${esc(m.id)}"${m.id===pick?" selected":""}>${esc(m.nm)} (${esc(m.id.replace("models/",""))})</option>`).join("");
      toast(`Kunci valid · ${ls.length} model tersedia.`)}catch(err){toast("Kunci/akses gagal: "+err.message,5000)}
    e.currentTarget&&(e.currentTarget.disabled=false)};
  $("#aiSave").onclick=()=>{const k=keyNow(),m=$("#aiModel").value,t=Math.max(3,Math.min(100,parseInt($("#aiThr").value)||15));
    if(!k){toast("Tempel kunci API dulu.");return}if(!m){toast("Tekan \"Muat daftar model\" lalu pilih model.");return}
    aiSetCfg({key:k,model:m,thr:t});toast("Pengaturan AI disimpan di browser ini.");renderAiCfg()};
  const d=$("#aiDel");if(d)d.onclick=async()=>{if(await confirmBox("Hapus kunci API?","Kunci dihapus dari browser ini. Hasil cek AI yang sudah ada tetap tersimpan.","Hapus",true)){aiSetCfg({thr:aiCfg().thr});renderAiCfg()}};
}

/* ---------- Beranda ---------- */
const tc=t=>(t||"").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
function dusunOf(nm){const m=(nm||"").match(/\b(DUSUN|DSN\.?|LINGKUNGAN|LINGK\.?|KAMPUNG|KRAJAN)\b\s*(.*)$/i);if(!m)return "Non-permukiman (sawah/kebun)";return m[1].toUpperCase().startsWith("KRAJAN")?"Dusun Krajan "+tc(m[2]):(/^(LINGKUNGAN|LINGK)/i.test(m[1])?"Lingkungan ":"Dusun ")+tc(m[2])}
function groupsFor(sl){
  const g={};
  for(const id of sl){const s=S.sls[id];const key=s.nmdesa||s.kddesa||"—";(g[key]=g[key]||[]).push(id)}
  return Object.entries(g).map(([k,ids])=>{const d={};ids.forEach(id=>{const k2=dusunOf(S.sls[id].nmsls);(d[k2]=d[k2]||[]).push(id)});
    return {k,ids,title:"Desa "+tc(k),sub:ids.length+" SLS · "+Object.keys(d).length+" dusun",dusun:Object.entries(d).map(([n,ids2])=>({k:k+"|"+n,title:n,ids:ids2}))}});
}
function vBeranda(){
  const u=me(),sl=scope(),st=sl.map(slsStat);
  const tot=st.reduce((a,b)=>({n:a.n+b.n,benar:a.benar+b.benar,salah:a.salah+b.salah,pindah:a.pindah+b.pindah,done:a.done+(b.done?1:0),tem:a.tem+b.tem,dij:a.dij+b.dij,far:a.far+b.far}),{n:0,benar:0,salah:0,pindah:0,done:0,tem:0,dij:0,far:0});
  const menunggu=Object.values(S.corr).filter(c=>c.jenis!=="benar"&&c.review==="menunggu").length;
  const scopeTxt=isAdmin()?"Seluruh Kecamatan "+NAMA_KEC():S.me.akses==="edit_kec"?"Seluruh Kecamatan "+NAMA_KEC()+" (lihat & edit)":((S.me.peran==="PML"?"Semua SLS PPL Anda":"Semua SLS tugas Anda")+(S.me.akses?" + akses khusus: "+AKSES[S.me.akses].toLowerCase():""));
  const groups=groupsFor(sl);if(groups.length===1)S.open[groups[0].k]=true;
  const nBatas=sl.filter(id=>S.sls[id].berubah_batas).length;
  $("#view").innerHTML=`<div class="scroll"><div class="wrap stagger">
    <div class="hello" style="--i:0"><div><div class="eyebrow">${esc(u.peran==="KOORDINATOR"?"Koordinator":u.admin&&u.peran!=="ADMIN"?u.peran+" · Admin":u.peran)}</div><h1>Halo, <span class="hl">${esc((u.nama||"").split(" ")[0])}</span></h1>${(()=>{const d=new Date().toDateString(),n=Object.values(S.corr).filter(c=>c.by===S.me.email&&c.at&&new Date(c.at).toDateString()===d).length;return `<div class="hand" style="margin-top:6px">${n?`hari ini kamu sudah memeriksa ${fmt(n)} titik — lanjut!`:"yuk mulai cek titik hari ini, satu per satu"}</div>`})()}</div>
      <div class="top-actions"><button class="icon-btn" id="rfBtn" type="button" aria-label="Muat ulang data" title="Muat ulang data">${ICON.refresh}</button><button class="btn btn-sm" id="insBtn" type="button">${small(ICON.install)}Pasang</button><button class="icon-btn theme-toggle" type="button"></button></div></div>
    ${(()=>{const pc=tot.n?tot.benar/tot.n*100:0,t0=new Date(),sisa=Math.round((new Date(2026,9,31)-new Date(t0.getFullYear(),t0.getMonth(),t0.getDate()))/864e5);
      const tag=sisa>1?`Target 31 Okt · sisa ${sisa} hari`:sisa===1?"Target 31 Okt · besok!":sisa===0?"Target 31 Okt · hari ini!":"Target 31 Okt lewat";
      return `<div class="glass card hero" style="--i:1">
      <div class="hero-box"><span class="hero-tag">${tag}</span>
        <small class="hero-lab">Titik bangunan sudah benar · ${esc(scopeTxt)}</small>
        <div class="hero-num mono">${fmt(tot.benar)}<span>/${fmt(tot.n)}</span></div>
        <div class="hero-sub"><b>${pc.toFixed(1).replace(".",",")}%</b> sudah dicek benar, <b>${fmt(tot.done)}</b> dari ${fmt(sl.length)} SLS sudah beres.${tot.far?` Masih ada <b>${fmt(tot.far)}</b> titik nomor sama berjauhan yang perlu dicek.`:""}</div>
        <div class="hero-bar"><i style="width:${pc.toFixed(1)}%"></i></div></div>
      <div class="angka"><small class="angka-t">${esc(NAMA_KEC())} dalam Angka</small><div class="angka-row">
        <div class="a hi"><b>SLS beres</b><span class="v mono">${fmt(tot.done)}<small>/${fmt(sl.length)}</small></span><small>${nBatas} berubah batas</small></div>
        <div class="a"><b>Perlu dicek</b><span class="v mono">${fmt(tot.far)}</span><small>nomor sama berjauhan</small></div>
        <div class="a"><b>Perbaikan lokasi</b><span class="v mono">${fmt(tot.pindah)}</span><small>${fmt(tot.salah)} titik ada kendala</small></div>
        <div class="a"><b>Temuan admin</b><span class="v mono">${fmt(tot.dij)}<small>/${fmt(tot.tem)}</small></span><small>sudah dijawab</small></div>
      </div></div></div>`})()}
    <div class="section-h" style="--i:2"><div><h2>Wilayah</h2><small class="muted">${scopeTxt} · per desa, dusun, lalu SLS</small></div>
      <label class="search" aria-label="Cari SLS">${ICON.search}<input class="field" id="q" placeholder="Cari SLS, dusun, atau nama petugas" value="${esc(S.q)}" autocomplete="off"></label></div>
    <div id="groups" style="--i:3;display:grid;gap:8px"></div>
    <div class="ver" style="--i:4">Cek Titik Bangunan · Kec. ${esc(NAMA_KEC())} · <span class="mono">Versi ${VERSI}</span> · diperbarui ${VERSI_TGL}</div>
  </div></div>`;
  if(!sl.length)$("#groups").innerHTML=`<div class="glass empty">Belum ada SLS untuk akun ini. Hubungi admin.</div>`;else drawGroups(groups);
  $("#q").oninput=e=>{S.q=e.target.value.trim().toLowerCase();drawGroups(groups)};
  $("#insBtn").onclick=doInstall;$("#rfBtn").onclick=refreshAll;
}
function matchQ(id,q){if(!q)return true;const s=S.sls[id],p=S.people[s.ppl_email]||{};return id.includes(q)||(s.nmsls||"").toLowerCase().includes(q)||(p.nama||"").toLowerCase().includes(q)||(nameOf(p.pml_email)||"").toLowerCase().includes(q)}
function sumStat(ids){const st=ids.map(slsStat);return{n:st.reduce((a,b)=>a+b.n,0),done:st.filter(x=>x.done).length,ok:st.reduce((a,b)=>a+b.benar,0),chk:st.reduce((a,b)=>a+b.benar,0),kd:st.reduce((a,b)=>a+b.salah,0),far:st.reduce((a,b)=>a+b.far,0)}}
function dusunHtml(g,q){return g.dusun.map(d=>{const ids=d.ids.filter(id=>matchQ(id,q));if(!ids.length)return"";const t=sumStat(d.ids),open=!!(q||S.open[d.k]);
  return `<section class="group sub ${open?"open":""}" data-g="${esc(d.k)}"><button class="group-h sub-h" type="button" aria-expanded="${open}"><div class="t"><b>${esc(d.title)}</b><small class="muted">${d.ids.length} SLS · <span style="color:var(--ok)">${fmt(t.ok)}</span>/${fmt(t.n)} titik benar${t.done?` · ${t.done} beres`:""}${t.kd?` · <span style="color:var(--magenta)">${t.kd} kendala</span>`:""}${t.far?` · <span style="color:var(--warn)">${t.far} perlu dicek</span>`:""}</small></div><span class="icon-btn chev">${ICON.down}</span></button>
    <div class="group-body"><div><div class="sls-rows" data-ids="${ids.join(",")}">${open?rowsHtml(ids):""}</div></div></div></section>`}).join("")}
function drawGroups(groups){
  const q=S.q,box=$("#groups");
  box.innerHTML=groups.map(g=>{
    if(!g.ids.some(id=>matchQ(id,q)))return"";
    const t=sumStat(g.ids),open=!!(q||S.open[g.k]);
    return `<section class="glass group ${open?"open":""}" data-g="${esc(g.k)}">
      <button class="group-h" type="button" aria-expanded="${open}"><div class="t"><b>${esc(g.title)}</b><small class="muted">${esc(g.sub)} · <b style="color:var(--ok);display:inline">${fmt(t.ok)}</b>/${fmt(t.n)} titik benar · ${t.done} SLS beres${t.kd?` · <span style="color:var(--magenta)">${fmt(t.kd)} kendala</span>`:""}</small>
        <div class="bar" style="margin-top:6px;max-width:260px"><i style="width:${t.n?Math.min(100,t.chk/t.n*100):0}%;background:var(--ok)"></i></div></div><span class="icon-btn chev">${ICON.down}</span></button>
      <div class="group-body"><div><div class="dusun-list" data-d="${esc(g.k)}">${open?dusunHtml(g,q):""}</div></div></div></section>`}).join("")||`<div class="glass empty">Tidak ada SLS yang cocok dengan “${esc(q)}”.</div>`;
  box.onclick=e=>{
    const h=e.target.closest(".group-h");
    if(h){const sec=h.parentElement,k=sec.dataset.g;
      if(sec.classList.contains("sub")){const rows=sec.querySelector(".sls-rows");if(!rows.innerHTML)rows.innerHTML=rowsHtml(rows.dataset.ids.split(","))}
      else{const dl=sec.querySelector(".dusun-list");if(!dl.innerHTML){dl.innerHTML=dusunHtml(groups.find(x=>x.k===k),q)}}
      S.open[k]=!S.open[k];h.setAttribute("aria-expanded",S.open[k]);requestAnimationFrame(()=>sec.classList.toggle("open",S.open[k]));return}
    const r=e.target.closest(".sls-row");if(!r)return;setSel(r.dataset.s);S._view=null;S.focus=null;S.detail=null;go("peta")};
}
function petugasTxt(id){const s=S.sls[id],p=S.people[s.ppl_email];if(S.me.peran==="PPL"&&!isAdmin())return"";
  const ppl=p?p.nama:(s.ppl_email||"—");if(isAdmin())return `<span>PPL ${esc(ppl)}</span><span>PML ${esc(p?nameOf(p.pml_email):"—")}</span>`;return `<span>PPL ${esc(ppl)}</span>`}
function rowsHtml(ids){return ids.map(id=>{const t=slsStat(id),s=S.sls[id];return `<button class="sls-row${t.done?" done":t.salah?" kd":""}" data-s="${id}" type="button"><span class="k">${id.slice(10,14)}${id.slice(14)!=="00"?"."+id.slice(14):""}</span><span class="mid"><b>${esc(s.nmsls||id)}</b><span class="meta">${petugasTxt(id)}<span>${t.n} titik · <b style="color:var(--ok);display:inline;font-size:inherit">${t.benar} benar</b></span>${t.salah?`<span style="color:var(--magenta)">${t.salah} kendala</span>`:""}${t.far?`<span style="color:var(--warn)">${t.far} perlu dicek</span>`:""}${t.tem-t.dij?`<span style="color:var(--magenta)">${t.tem-t.dij} temuan</span>`:""}${s.berubah_batas?`<span style="color:var(--cyan);font-weight:700">● batas berubah</span>`:""}${s.peta_sls?`<span style="color:var(--warn);font-weight:700">⇄ peta ${s.peta_sls.slice(10,14)}</span>`:""}${canEdit(id)?"":`<span class="dim">👁 lihat saja</span>`}${S.scans[petaOf(id)]?"":`<span class="dim">scan belum ada</span>`}</span></span><span class="pill ${t.status[1]}">${t.status[0]}</span></button>`}).join("")}
function setSel(id){S.sel=id;store.set("ctb-sel-"+KEC.kode+"-"+S.me.email,id)}

/* ---------- Peta ---------- */
let map=null,L_pts=null,L_bat=null,L_ctx=null,L_cor=null,scanLayer=null,baseLayer=null,ptMarkers={},popup=null,popFor=null;
function destroyMap(){if(map){map.remove();map=null;ptMarkers={};popup=null;popFor=null;scanLayer=null;baseLayer=null}}
const ImageTri=L.Layer.extend({
  initialize(url,tl,tr,bl,op){this.url=url;this.tl=L.latLng(tl[1],tl[0]);this.tr=L.latLng(tr[1],tr[0]);this.bl=L.latLng(bl[1],bl[0]);this.op=op},
  onAdd(m){this._m=m;const img=this._img=L.DomUtil.create("img","leaflet-image-layer leaflet-zoom-animated");
    img.style.transformOrigin="0 0";img.style.opacity=0;img.style.transition="opacity .5s";img.style.pointerEvents="none";img.alt="";
    img.onload=()=>{this._reset();requestAnimationFrame(()=>img.style.opacity=this.op)};img.onerror=()=>toast("Gambar scan gagal dimuat.");img.crossOrigin="anonymous";img.src=this.url;(m.getPane("scan")||m.getPanes().overlayPane).appendChild(img);
    m.on("zoomanim",this._anim,this);m.on("viewreset zoomend moveend move",this._reset,this)},
  onRemove(m){this._img.remove();m.off("zoomanim",this._anim,this);m.off("viewreset zoomend moveend move",this._reset,this)},
  setOpacity(o){this.op=o;if(this._img)this._img.style.opacity=o},
  _apply(p0,p1,p2){const img=this._img,w=img.naturalWidth,h=img.naturalHeight;if(!w)return;img.style.width=w+"px";img.style.height=h+"px";
    img.style.transform=`matrix(${(p1.x-p0.x)/w},${(p1.y-p0.y)/w},${(p2.x-p0.x)/h},${(p2.y-p0.y)/h},${p0.x},${p0.y})`},
  _reset(){const m=this._m;if(!m||m._animatingZoom)return;this._apply(m.latLngToLayerPoint(this.tl),m.latLngToLayerPoint(this.tr),m.latLngToLayerPoint(this.bl))},
  _anim(e){const m=this._m,f=ll=>m._latLngToNewLayerPoint(ll,e.zoom,e.center);this._apply(f(this.tl),f(this.tr),f(this.bl))}
});
const petaOf=id=>(S.sls[id]&&S.sls[id].peta_sls)||id;
const geomOf=s=>S.geoms[s]?{type:"MultiPolygon",coordinates:S.geoms[s]}:null;
const ptsOf=s=>S.pts[s]||[];
const ptById=id=>ptsOf(S.sel).find(x=>x.id===id);
function inPoly(lng,lat,mp){if(!mp)return true;let inside=false;for(const poly of mp.coordinates){let inP=false;poly.forEach((ring,ri)=>{let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const[xi,yi]=ring[i],[xj,yj]=ring[j];if(((yi>lat)!==(yj>lat))&&(lng<(xj-xi)*(lat-yi)/(yj-yi)+xi))c=!c}if(ri===0)inP=c;else if(c)inP=false});if(inP)inside=true}return inside}
const cssv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function ringCol(p){const c=S.corr[p.id];if(c&&c.jenis==="benar")return "#3ddc8c";if(isKendala(c)&&c.jenis!=="tidak_di_peta")return "#e566f4";if(c)return "#ffd23f";return p.far?"#ffb648":"#ffffff"}
const ctxFC=id=>({type:"FeatureCollection",features:S.slsIds.filter(x=>x!==id&&S.sls[x].kddesa===S.sls[id].kddesa&&S.geoms[x]).map(x=>({type:"Feature",properties:{},geometry:geomOf(x)}))});
const BASES={sat:()=>L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxNativeZoom:19,maxZoom:22,crossOrigin:true,attribution:"Citra © Esri, Maxar",keepBuffer:3,updateWhenIdle:true})};

async function vPeta(){
  const sl=scope();if(!sl.length){$("#view").innerHTML=`<div class="scroll"><div class="wrap"><div class="glass empty">Belum ada SLS untuk akun ini.</div></div></div>`;return}
  if(!sl.includes(S.sel))setSel(sl[0]);
  $("#view").innerHTML=`<div style="position:absolute;inset:0"><div id="map"></div>
   <div class="map-top" id="mapTop"></div>
   <div class="fab-col" id="fabs"><button class="fab glass solid" id="zin" type="button" aria-label="Perbesar">${ICON.plus}</button><button class="fab glass solid" id="zout" type="button" aria-label="Perkecil">${ICON.minus}</button><button class="fab glass solid" id="zfit" type="button" aria-label="Ke batas SLS">${ICON.target}</button></div>
   <div class="glass solid sheet" id="sheet"></div>
   <div class="glass solid place-banner" id="placeBanner" hidden></div><div class="place-cross" aria-hidden="true"><i></i></div>
   <div class="glass solid map-loading" id="mapLoading"><div class="spinner"></div>Memuat titik…</div></div>`;
  destroyMap();
  map=L.map("map",{preferCanvas:true,zoomControl:false,attributionControl:true,maxZoom:22,minZoom:11,zoomSnap:.25,wheelPxPerZoomLevel:90,inertiaDeceleration:2600,tapTolerance:20,center:[-8.2,113.17],zoom:13});
  map.attributionControl.setPrefix(false);
  map.createPane("scan").style.zIndex=350;
  baseLayer=BASES.sat().addTo(map);
  L_ctx=L.geoJSON(null,{style:{color:"#ff7a8f",weight:1,opacity:.55,fill:false,dashArray:"4 4"},interactive:false}).addTo(map);
  L_bat=L.geoJSON(null,{style:{color:"#ff5f7e",weight:3,opacity:.95,fill:false,dashArray:"10 6"},interactive:false});
  if(S.showBatas)L_bat.addTo(map);
  const zh=()=>map.getContainer().classList.toggle("zoom-hi",map.getZoom()>=18.25);
  map.on("zoomend",zh);
  map.on("moveend",()=>{if(S.sel)S._view={sls:S.sel,c:map.getCenter(),z:map.getZoom()}});
  map.on("click",onMapClick);
  $("#zin").onclick=()=>map.zoomIn();$("#zout").onclick=()=>map.zoomOut();$("#zfit").onclick=()=>fitSls(true);
  renderHead(true);renderSheet();
  await showSls(S.sel,false);zh();
}
async function showSls(id,anim){
  const ld=$("#mapLoading");if(ld)ld.hidden=false;
  try{await loadSlsDetail(id)}catch(e){toast("Gagal memuat SLS: "+e.message);if(ld)ld.hidden=true;return}
  if(!map||S.sel!==id)return;
  if(ld)ld.hidden=true;
  const ar=petaOf(id),sc=S.urls[ar]||{};if(S.scan==="inset"&&!sc.inset)S.scan="wss";
  L_ctx.clearLayers();L_ctx.addData(ctxFC(ar));L_bat.clearLayers();if(geomOf(ar))L_bat.addData(geomOf(ar));
  if(S._view&&S._view.sls===id)map.setView(S._view.c,S._view.z,{animate:false});else fitSls(anim);
  setScan();drawPts();renderHead();renderSheet(anim?true:undefined);renderBanner();
  if(S.focus){const p=ptById(S.focus);if(p)setTimeout(()=>openPop(p,!!(S.corr[p.id]&&S.corr[p.id].lat)),450)}
}
function fitSls(anim){
  let b=null;const g=geomOf(petaOf(S.sel));
  if(g)b=L.geoJSON(g).getBounds();else if(ptsOf(S.sel).length)b=L.latLngBounds(ptsOf(S.sel).map(p=>[p.y,p.x]));
  if(!b||!b.isValid())return;
  const o=MOBILE()?{paddingTopLeft:[14,S.minHead?60:180],paddingBottomRight:[14,(S.minSheet?80:innerHeight*.4)+60]}:{paddingTopLeft:[20,20],paddingBottomRight:[370,20]};
  anim?map.flyToBounds(b,{...o,duration:.9,easeLinearity:.15}):map.fitBounds(b,o);
}
function setScan(){
  if(scanLayer){const old=scanLayer;scanLayer=null;if(old._img){old._img.style.opacity=0;setTimeout(()=>old.remove(),450)}else old.remove()}
  const sc=S.urls[petaOf(S.sel)];if(S.scan==="off"||!sc)return;
  const r=sc[S.scan];if(!r)return;
  scanLayer=new ImageTri(r.url,r.tl,r.tr,r.bl,S.opac).addTo(map);
}
const slsCode=id=>id.slice(10,14)+(id.slice(14)!=="00"?"."+id.slice(14):"");
function slsSelectHtml(){const s=S.sls[S.sel]||{};
  return `<div class="pick"><button type="button" class="field pick-btn" id="slsBtn" aria-haspopup="listbox" aria-expanded="false"><span class="mono">${slsCode(S.sel)}</span><span class="nm">${esc(shortNm(s.nmsls||""))}</span>${s.berubah_batas?`<i class="dotc" title="batas berubah"></i>`:""}<svg class="cv" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button></div>`;
}
function pickList(q){q=(q||"").toLowerCase();
  return groupsFor(scope()).map(g=>g.dusun.map(d=>{const ids=d.ids.filter(id=>!q||id.includes(q)||slsCode(id).includes(q)||(S.sls[id].nmsls||"").toLowerCase().includes(q));if(!ids.length)return"";
    return `<div class="pk-g"><span class="pk-d">${esc(g.title)}</span><span class="pk-u">${esc(d.title)}</span></div>`+ids.map(id=>{const x=S.sls[id],t=slsStat(id);return `<button type="button" class="pk-i ${id===S.sel?"on":""}" data-id="${id}" role="option"><span class="mono">${slsCode(id)}</span><span class="nm">${esc(shortNm(x.nmsls||""))}</span>${x.berubah_batas?`<i class="dotc" title="batas berubah"></i>`:""}${x.peta_sls?`<em>⇄</em>`:""}<span class="pill ${t.status[1]}">${t.status[0]}</span></button>`}).join("")}).join("")).join("")||`<div class="pk-g" style="text-transform:none">Tidak ada SLS yang cocok.</div>`}
function openPick(){const host=$(".pick");if(!host||host.querySelector(".pick-pop"))return closePick();
  const btn=$("#slsBtn");btn.setAttribute("aria-expanded","true");
  const pop=document.createElement("div");pop.className="glass solid pick-pop";pop.setAttribute("role","listbox");
  pop.innerHTML=`<input class="field pk-q" placeholder="Cari kode atau nama SLS" autocomplete="off"><div class="pk-list">${pickList("")}</div>`;
  host.appendChild(pop);requestAnimationFrame(()=>pop.classList.add("show"));
  const on=pop.querySelector(".pk-i.on");if(on)on.scrollIntoView({block:"center"});
  const q=pop.querySelector(".pk-q");if(!MOBILE())q.focus();
  q.oninput=()=>{pop.querySelector(".pk-list").innerHTML=pickList(q.value.trim())};
  pop.onclick=e=>{const it=e.target.closest(".pk-i");if(!it)return;const id=it.dataset.id;closePick();if(id!==S.sel)setTimeout(()=>switchSls(id),120)};
  setTimeout(()=>document.addEventListener("pointerdown",pickOut,true),0);
}
function pickOut(e){if(!e.target.closest(".pick"))closePick()}
function closePick(){document.removeEventListener("pointerdown",pickOut,true);const pop=$(".pick-pop");const b=$("#slsBtn");b&&b.setAttribute("aria-expanded","false");
  if(pop){pop.classList.remove("show");pop.classList.add("hide");setTimeout(()=>pop.remove(),200)}}
function renderHead(first){
  const el=$("#mapTop");if(!el)return;const ar=petaOf(S.sel),sc=S.urls[ar]||{},has=!!(S.scans[ar]);
  if(S.minHead){
    el.innerHTML=`<div class="glass solid mini-head a-grow"><span class="mono" style="font-size:11.5px;font-weight:700">${(S.sel||"").slice(10,14)}</span><span class="dim" style="font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(shortNm(S.sls[S.sel].nmsls))}</span><button class="icon-btn" id="headMax" type="button" aria-label="Buka pengaturan peta">${ICON.layers}</button></div>`;
    $("#headMax").onclick=()=>collapseHead(false);return;
  }
  el.innerHTML=`<div class="glass map-head ${first?"a-down":""}">
     <div class="row between" style="flex-wrap:nowrap"><span class="eyebrow">Pengaturan peta</span><button class="icon-btn" id="headMin" type="button" aria-label="Kecilkan pengaturan">${ICON.minimize}</button></div>
     ${slsSelectHtml()}
     <div class="layers">
       <div class="seg" role="group" aria-label="Lembar scan"><button type="button" data-sc="wss" class="${S.scan==="wss"&&has?"on":""}" ${has?"":"disabled"}>WSS</button><button type="button" data-sc="inset" class="${S.scan==="inset"&&sc.inset?"on":""}" ${S.scans[ar]&&S.scans[ar].inset?"":"disabled"}>Inset</button><button type="button" data-sc="off" class="${S.scan==="off"||!has?"on":""}">Tanpa</button></div>
       <label class="opac" for="opac">Transparan<input id="opac" type="range" min="0" max="1" step="0.05" value="${S.opac}" ${has?"":"disabled"}></label>
     </div>
     ${has?"":`<small class="dim">Scan peta SLS ini belum diunggah admin.</small>`}
     ${ar!==S.sel?`<small style="color:var(--warn);font-weight:700">⇄ Kode SLS tertukar: titik SLS ini dicocokkan dengan peta WSS ${ar.slice(10,14)} · ${esc(shortNm((S.sls[ar]||{}).nmsls||""))}</small>`:""}
     ${S.sls[S.sel].berubah_batas?`<small style="color:var(--cyan);font-weight:700">● SLS ini mengalami perubahan batas</small>`:""}
     ${isAdmin()?`<button class="btn btn-sm btn-ghost" id="swapBtn" type="button" style="justify-self:start">Kode SLS tertukar? Pilih peta yang cocok</button>`:""}
     <div class="row between">
       <div class="row" style="gap:6px"><button type="button" class="chip ${S.showPts?"on":""}" id="tPts">Titik</button><button type="button" class="chip ${S.showBatas?"on":""}" id="tBat">Batas SLS</button><button type="button" class="chip ${S.base==="sat"?"on":""}" id="tBase">Satelit</button></div>
       <div class="legend"><span><i style="background:var(--pt)"></i>asli</span><span><i style="background:var(--pt-new)"></i>perbaikan</span><span><i style="background:var(--pt);border-color:#ffb648"></i>perlu dicek</span></div>
     </div>
   </div>`;
  $("#headMin").onclick=()=>collapseHead(true);
  if($("#swapBtn"))$("#swapBtn").onclick=setPeta;
  $("#slsBtn").onclick=openPick;
  el.querySelector(".seg").onclick=e=>{const b=e.target.closest("[data-sc]");if(!b||b.disabled)return;S.scan=b.dataset.sc;el.querySelectorAll(".seg button").forEach(x=>x.classList.toggle("on",x===b));setScan()};
  $("#opac").oninput=e=>{S.opac=+e.target.value;scanLayer&&scanLayer.setOpacity(S.opac)};
  $("#tPts").onclick=e=>{S.showPts=!S.showPts;e.currentTarget.classList.toggle("on",S.showPts);if(S.showPts){L_pts&&L_pts.addTo(map);L_cor&&L_cor.addTo(map)}else{closePop();L_pts&&L_pts.remove();L_cor&&L_cor.remove()}};
  $("#tBat").onclick=e=>{S.showBatas=!S.showBatas;e.currentTarget.classList.toggle("on",S.showBatas);S.showBatas?L_bat.addTo(map):L_bat.remove()};
  $("#tBase").onclick=e=>{S.base=S.base==="sat"?"off":"sat";e.currentTarget.classList.toggle("on",S.base==="sat");if(S.base==="sat")baseLayer.addTo(map);else baseLayer.remove()};
}
async function setPeta(){
  const id=S.sel,cur=petaOf(id),kd=S.sls[id].kddesa;
  const cand=S.slsIds.filter(x=>x!==id).sort((a,b)=>(S.sls[a].kddesa===kd?0:1)-(S.sls[b].kddesa===kd?0:1)||a.localeCompare(b));
  const opt=x=>`<option value="${x}" ${x===cur?"selected":""}>${x.slice(10,14)}${x.slice(14)!=="00"?"."+x.slice(14):""} · ${esc(shortNm(S.sls[x].nmsls))} — ${esc(tc(S.sls[x].nmdesa||""))}${S.scans[x]?"":" (scan belum ada)"}</option>`;
  const v=await modal(`<h3>Kode SLS tertukar</h3>
    <p class="muted" style="margin:0">Pilih SLS yang peta WSS-nya cocok dengan titik bangunan <b>${id.slice(10,14)} · ${esc(shortNm(S.sls[id].nmsls))}</b>. Titik asli tidak diubah; aplikasi hanya menampilkan peta, batas, dan scan dari SLS yang dipilih saat memeriksa SLS ini.</p>
    <label class="muted" style="font-size:11.5px">Titik SLS ini cocok dengan peta<select class="field" id="pT"><option value="${id}" ${cur===id?"selected":""}>Peta SLS sendiri (tidak tertukar)</option>${cand.map(opt).join("")}</select></label>
    <label class="row" style="gap:8px;font-size:12px;flex-wrap:nowrap"><input type="checkbox" id="pB" checked> Tukar timbal balik (SLS yang dipilih juga memakai peta SLS ini)</label>
    <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn btn-sm btn-ghost" data-r="no" type="button">Batal</button><button class="btn btn-sm" data-r="ok" type="button">Simpan</button></div>`,
    {onOpen:w=>{w._val=()=>({t:w.querySelector("#pT").value,b:w.querySelector("#pB").checked})}});
  if(!v)return;
  const ups=[[id,v.t===id?null:v.t]];
  if(v.b){if(v.t!==id)ups.push([v.t,id]);else if(cur!==id&&S.sls[cur].peta_sls===id)ups.push([cur,null])}
  for(const[x,p]of ups){const{error}=await sb.from("sls").update({peta_sls:p}).eq("idsubsls",x);if(error)return toast("Gagal menyimpan: "+error.message,4500);S.sls[x].peta_sls=p}
  toast(v.t===id?"Peta dikembalikan ke SLS sendiri.":"Tersimpan: titik "+id.slice(10,14)+" memakai peta "+v.t.slice(10,14)+".");
  closePop(true);S._view=null;await showSls(id,true);
}
function collapseHead(min){const cur=$("#mapTop").firstElementChild;cur.style.transition="opacity .16s,transform .2s var(--ease-in)";cur.style.opacity="0";cur.style.transform="perspective(800px) scale(.88) rotateX(12deg)";setTimeout(()=>{S.minHead=min;renderHead()},150)}
function switchSls(id){
  closePop(true);setSel(id);S.focus=null;S.placing=null;S.draft=null;S.detail=null;S._view=null;
  if(L_pts)L_pts.remove();if(L_cor)L_cor.remove();if(scanLayer){scanLayer.remove();scanLayer=null}
  renderHead();renderSheet();showSls(id,true);
}
function drawPts(){
  if(!map)return;
  if(L_pts)L_pts.remove();if(L_cor)L_cor.remove();
  L_pts=L.layerGroup();L_cor=L.layerGroup();ptMarkers={};
  const blue=cssv("--pt")||"#3b82f6";
  ptsOf(S.sel).forEach(p=>{
    const c=S.corr[p.id],moved=c&&c.jenis==="pindah"&&c.lat!=null;
    const m=L.circleMarker([p.y,p.x],{radius:6,color:ringCol(p),weight:2,fillColor:blue,fillOpacity:moved?.45:1,bubblingMouseEvents:false});
    m.bindTooltip(String(+p.no||p.no),{permanent:true,interactive:true,direction:"right",offset:[6,0],className:"nb"+(c&&c.jenis==="benar"?" ok":(p.far?" warn":""))});
    m.on("click",ev=>{L.DomEvent.stop(ev);if(S.placing){placeTap(ev.latlng);return}openPop(p)});
    m.addTo(L_pts);ptMarkers[p.id]=m;
    if(moved){
      L.polyline([[p.y,p.x],[c.lat,c.lng]],{color:"#ffd23f",weight:2,dashArray:"5 5",interactive:false}).addTo(L_cor);
      L.circleMarker([c.lat,c.lng],{radius:7,color:"#ffffff",weight:2,fillColor:"#ffd23f",fillOpacity:1,bubblingMouseEvents:false})
        .bindTooltip(String(+p.no||p.no),{permanent:true,interactive:true,direction:"right",offset:[7,0],className:"nb new"})
        .on("click",ev=>{L.DomEvent.stop(ev);if(S.placing){placeTap(ev.latlng);return}openPop(p,true)}).addTo(L_cor);
    }
  });
  const fp=S.focus&&S.draft&&S.draft.lat&&ptById(S.focus);
  if(fp){L.polyline([[fp.y,fp.x],[S.draft.lat,S.draft.lng]],{color:"#ffd23f",weight:2,dashArray:"3 6",interactive:false}).addTo(L_cor);
    L.circleMarker([S.draft.lat,S.draft.lng],{radius:8,color:"#ffd23f",weight:3,fillColor:"#ffd23f",fillOpacity:.35,interactive:false}).addTo(L_cor)}
  if(S.showPts){L_pts.addTo(map);L_cor.addTo(map)}
  styleMarkers();drawAi();
}
function styleMarkers(){Object.entries(ptMarkers).forEach(([id,m])=>{const sel=id===S.focus;m.setStyle({radius:sel?9:6,weight:sel?3:2});if(sel)m.bringToFront()})}
function nearest(latlng){
  if(!S.showPts)return null;const pt=map.latLngToContainerPoint(latlng);let best=null,bd=MOBILE()?30:22;
  for(const p of ptsOf(S.sel)){const c=S.corr[p.id];
    let d=map.latLngToContainerPoint([p.y,p.x]).distanceTo(pt);if(d<bd){bd=d;best={p,atNew:false}}
    if(c&&c.lat!=null&&c.jenis==="pindah"){d=map.latLngToContainerPoint([c.lat,c.lng]).distanceTo(pt);if(d<bd){bd=d;best={p,atNew:true}}}}
  return best;
}
function onMapClick(e){
  if(S.placing){placeTap(e.latlng);return}
  const n=nearest(e.latlng);
  if(n){openPop(n.p,n.atNew);return}
  if(popFor)closePop();
}

/* ---------- Popup ---------- */
function maskNik(v){v=String(v);return v.length>6?v.slice(0,4)+"*".repeat(v.length-6)+v.slice(-2):"******"}
const kkNames=p=>p.kel&&p.kel.length?p.kel.map(k=>k.n).filter(Boolean).join(", "):"";
const ptTitle=(p,def)=>kkNames(p)||p.nu||def;
function corrMeta(c){return c?`${esc(nameOf(c.by))} · ${esc(tgl(c.at))}`:""}
function popHtml(p){
  const c=S.corr[p.id],d=S.draft&&S.focus===p.id?S.draft:null,ed=canEdit(p.sls);
  const same=ptsOf(S.sel).filter(x=>x.ub===p.ub).length;
  const head=`<div class="pop-h"><span class="no ${c&&c.jenis==="pindah"?"new":(p.far?"warn":"")}">${esc(+p.no||p.no)}</span><div style="min-width:0"><b>${esc(ptTitle(p,p.kk?"Bangunan tempat tinggal":"Bangunan nomor "+(+p.no||p.no)))}</b><small class="muted">${p.kel&&p.kel.length?p.kel.length+" KK"+(p.nu?" · "+esc(p.nu):""):same+" keluarga/usaha"} · kode ${esc(p.kb)}</small></div></div>`;
  if(d&&d.mode==="tanpa")return `<div class="pop">${head}
      <span class="pill p-mag" style="justify-self:start">Titik bangunan tidak ada di scan</span>
      <small class="muted">Tulis nomor bangunan yang <b>ada di gambar scan</b> SLS ini tetapi <b>tidak punya titik digital</b>. Pisahkan dengan koma.</small>
      <input class="field" id="tanpaNo" inputmode="numeric" placeholder="mis. 13,15,17" autocomplete="off">
      <div class="acts"><button class="btn btn-grad" data-act="savetanpa" type="button">Simpan</button><button class="btn btn-ghost" data-act="cancel" type="button">Batal</button></div></div>`;
  if(d&&d.mode==="note")return `<div class="pop">${head}
      <span class="pill ${d.jenis==="tidak_di_peta"?"p-mag":"p-info"}" style="justify-self:start">${d.jenis==="tidak_di_peta"?"Tidak ada di gambar peta":"Catatan titik"}</span>
      <textarea id="popNote" placeholder="Tulis catatan, mis. nomor ${esc(+p.no||p.no)} di gambar ada di seberang jalan">${esc(d.note||"")}</textarea>
      <div class="acts"><button class="btn btn-grad" data-act="savenote" type="button">Simpan</button><button class="btn btn-ghost" data-act="cancel" type="button">Batal</button></div></div>`;
  const info=c&&c.jenis!=="benar"?`<div style="display:grid;gap:4px">
      ${c.jenis!=="catatan"?`<div class="row" style="gap:5px"><span class="pill ${c.jenis==="pindah"?"p-new":"p-mag"}">${jenisTxt(c)}</span></div>`:""}
      ${c.note?`<div style="font-size:11.5px">“${esc(c.note)}”</div>`:""}
      <div class="dim" style="font-size:10.5px">${corrMeta(c)}</div></div>`:(c&&c.jenis==="benar"?`<div class="dim" style="font-size:10.5px">Ditandai benar · ${corrMeta(c)}</div>`:"");
  const rw=S.riw&&S.riw[p.id],rwh=rw&&!(c&&c.jenis==="pindah")?`<div class="dim" style="font-size:10.5px">Riwayat terakhir: ${JENIS[rw.jenis]||"perbaikan"} oleh ${esc(nameOf(rw.oleh_email))} · ${esc(tgl(rw.waktu))} · sudah digabung ${esc(tgl(rw.digabung_at))}</div>`:"";
  return `<div class="pop">${head}
    ${p.far&&!(c&&c.jenis==="pindah")?`<div class="note"><b style="color:var(--warn)">Perlu dicek.</b> Titik bernomor ${esc(+p.no||p.no)} di SLS ini berjarak lebih dari 20 m.</div>`:""}
    ${info}${rwh}
    ${ed?`<div class="acts"><button class="btn btn-ghost" data-act="note" type="button">${c&&c.note?"✎ Catatan":"+ Catatan"}</button><button class="btn btn-grad" data-act="fix" type="button">${c&&c.jenis==="pindah"?"Ubah lokasi":"Perbaiki lokasi"}</button></div>
    <div class="row between">${c&&c.jenis==="pindah"?`<button class="link" data-act="reset" type="button">Kembalikan ke lokasi asal</button>`:`<button class="link" data-act="tanpa" type="button">Titik bangunan tidak ada di scan</button>`}<button class="link" data-act="detail" type="button">Detail</button></div>`
    :`<div class="row between"><small class="dim">Hanya bisa dilihat</small><button class="link" data-act="detail" type="button">Detail</button></div>`}</div>`;
}
function openPop(p,atNew){
  const changing=popFor&&popFor!==p.id;
  S.focus=p.id;styleMarkers();
  const c=S.corr[p.id],d=S.draft&&S.focus===p.id?S.draft:null;
  const ll=d&&d.lat?[d.lat,d.lng]:(atNew&&c&&c.lat!=null?[c.lat,c.lng]:[p.y,p.x]);
  const top=MOBILE()?($("#mapTop").offsetHeight+20):20,bot=MOBILE()?($("#sheet").offsetHeight+80):20,right=MOBILE()?14:370;
  if(!popup)popup=L.popup({className:"pp",maxWidth:260,minWidth:236,closeButton:false,closeOnClick:false,autoClose:false});
  popup.options.autoPanPaddingTopLeft=L.point(14,top);popup.options.autoPanPaddingBottomRight=L.point(right,bot);
  const show=()=>{popup.setLatLng(ll).setContent(popHtml(p));if(!map.hasLayer(popup))popup.openOn(map);popFor=p.id;bindPop(p)};
  if(changing&&popup.getElement()){const el=popup.getElement();el.classList.add("closing");popFor=null;setTimeout(()=>{el.classList.remove("closing");map.closePopup(popup);show()},150)}else show();
  markList();
}
function closePop(instant){
  if(!popup||!popFor)return;
  const el=popup.getElement();popFor=null;S.focus=null;S.draft=null;styleMarkers();markList();
  if(instant||!el){map&&map.closePopup(popup);return}
  el.classList.add("closing");setTimeout(()=>{el.classList.remove("closing");if(!popFor&&map)map.closePopup(popup)},170);
}
function markList(){document.querySelectorAll("#sheet .li[data-p]").forEach(b=>b.style.borderColor=b.dataset.p===S.focus?"var(--line2)":"")}
function refreshPop(p,ll){if(!popup)return;if(ll)popup.setLatLng(ll);popup.setContent(popHtml(p));bindPop(p)}
function bindPop(p){
  const el=popup.getElement();if(!el)return;
  L.DomEvent.disableClickPropagation(el);L.DomEvent.disableScrollPropagation(el);
  el.querySelectorAll("[data-act]").forEach(b=>b.onclick=async ev=>{
    ev.stopPropagation();
    const a=b.dataset.act,c=S.corr[p.id];
    if(a==="fix"){startPlace(p);return}
    if(a==="note"){S.draft={mode:"note",jenis:c?c.jenis:"catatan",note:c?c.note:""};refreshPop(p);setTimeout(()=>{const t=$("#popNote");t&&t.focus()},60);return}
    if(a==="tdk"){S.draft={mode:"note",jenis:"tidak_di_peta",note:c?c.note:""};refreshPop(p);return}
    if(a==="tanpa"){S.draft={mode:"tanpa"};refreshPop(p);setTimeout(()=>{const t=$("#tanpaNo");t&&t.focus()},60);return}
    if(a==="savetanpa"){b.disabled=true;const ok=await addTanpa(p.sls,$("#tanpaNo").value);if(ok){S.draft=null;refreshPop(p)}else b.disabled=false;return}
    if(a==="cancel"){S.draft=null;refreshPop(p);return}
    if(a==="savenote"){const d=S.draft,note=$("#popNote").value.trim();
      if(d.jenis==="tidak_di_peta"&&!note){toast("Tulis catatan singkat kenapa titik ini tidak ada di peta.");return}
      b.disabled=true;
      if(!note&&d.jenis==="catatan"){await removeCorr(p);await syncDone(p.sls);return}
      await save(p,{jenis:d.jenis,note,lat:d.jenis==="pindah"&&c?c.lat:null,lng:d.jenis==="pindah"&&c?c.lng:null});return}
    if(a==="reset"){b.disabled=true;if(c&&c.note)await save(p,{jenis:"catatan",note:c.note});else await removeCorr(p);return}
    if(a==="detail"){S.detail=p.id;if(S.minSheet)toggleSheet(false);else renderSheet("detail");return}
  });
}
async function addTanpa(sls,txt){
  const nos=[...new Set((txt||"").split(/[^0-9]+/).filter(Boolean).map(x=>String(+x).padStart(4,"0")))];
  if(!nos.length){toast("Tulis nomor bangunannya, mis. 13,15,17.");return false}
  const now=new Date().toISOString(),rows=nos.map(n=>({idsubsls:sls,jenis:"tanpa_titik",no_bang:n,keterangan:"Dilaporkan "+nameOf(S.me.email)+": nomor ada di scan, titik digital tidak ada",jawaban:"Dilaporkan petugas",dijawab_oleh:S.me.email,dijawab_at:now}));
  const{error}=await sb.from("temuan").upsert(rows,{onConflict:"idsubsls,jenis,no_bang",ignoreDuplicates:true});
  if(error){toast("Gagal menyimpan: "+error.message);return false}
  const{data}=await sb.from("temuan").select("id,idsubsls,jenis,no_bang,keterangan,jawaban,dijawab_oleh").eq("idsubsls",sls).order("id");
  if(data)S.temuan[sls]=data;renderSheet();toast(`Tersimpan sebagai temuan SLS: nomor ${nos.map(n=>+n).join(", ")}.`,3500);return true;
}
async function removeCorr(p){
  const{error}=await sb.from("koreksi").delete().eq("assignment_id",p.id);
  if(error){toast("Gagal: "+error.message);refreshPop(p);return}
  delete S.corr[p.id];S._corrVer=(S._corrVer||0)+1;S.draft=null;drawPts();refreshPop(p,[p.y,p.x]);renderSheet();syncDone(p.sls).then(()=>renderSheet());toast("Perbaikan dihapus, titik kembali ke lokasi asal.");
}
async function save(p,d,opt={}){
  const row={assignment_id:p.id,idsubsls:p.sls,no_bang:p.no,unique_bang:p.ub,jenis:d.jenis,lon:d.jenis==="pindah"?d.lng:null,lat:d.jenis==="pindah"?d.lat:null,catatan:d.note||null,jumlah:d.jenis==="dobel"?(+d.jumlah||2):null,oleh_email:S.me.email,
    status:d.jenis==="benar"||d.jenis==="catatan"?"ok":"disetujui"};
  const {data,error}=await sb.from("koreksi").upsert(row,{onConflict:"assignment_id"}).select().single();
  if(error){toast("Gagal menyimpan: "+error.message);if(!opt.silent)refreshPop(p);return false}
  (S.corr[p.id]=corrFromRow(data),S._corrVer=(S._corrVer||0)+1);S.draft=null;drawPts();renderSheet();syncDone(p.sls).then(()=>renderSheet());
  toast(d.jenis==="pindah"?`Lokasi baru tersimpan · ${nameOf(S.me.email)} · ${tgl(data.updated_at)}`:d.jenis==="tidak_di_peta"?"Tersimpan: tidak ada di peta.":"Catatan tersimpan.");
  if(!opt.silent)refreshPop(p,data.lat!=null?[data.lat,data.lon]:[p.y,p.x]);
  return true;
}
async function review(aid,status){
  const {data,error}=await sb.from("koreksi").update({status}).eq("assignment_id",aid).select().single();
  if(error){toast("Gagal: "+error.message);return false}
  (S.corr[aid]=corrFromRow(data),S._corrVer=(S._corrVer||0)+1);toast(status==="disetujui"?"Perbaikan disetujui.":"Perbaikan ditolak.");return true;
}
function startPlace(p){
  S.draft=null;S.placing=p.id;
  if(popup&&popup.getElement()){const e=popup.getElement();e.classList.add("closing");popFor=null;setTimeout(()=>{e.classList.remove("closing");if(!popFor)map.closePopup(popup)},160)}
  if(MOBILE()&&!S.minSheet)toggleSheet(true);
  const c=S.corr[p.id],start=c&&c.jenis==="pindah"&&c.lat!=null?[c.lat,c.lng]:[p.y,p.x];
  map.setView(start,Math.max(map.getZoom(),19),{animate:true});
  renderBanner();
}
function renderBanner(){
  const el=$("#placeBanner");if(!el)return;
  const wrap=map&&map.getContainer().parentElement;
  if(!S.placing){wrap&&wrap.classList.remove("place-mode","cross");if(!el.hidden){el.style.transition="opacity .2s,transform .2s var(--ease-in)";el.style.opacity="0";el.style.transform="translate(-50%,-14px)";setTimeout(()=>{el.hidden=true;el.style.cssText=""},200)}return}
  const p=ptById(S.placing);el.style.cssText="";el.hidden=false;wrap.classList.add("place-mode","cross");
  el.innerHTML=`<span class="no new">${esc(+p.no||p.no)}</span><div style="flex:1;min-width:0"><b>Geser peta sampai tanda ＋ tepat di bangunan</b><div class="muted" style="font-size:11px">${MOBILE()?"Perbesar peta agar pas, lalu tekan Simpan":"Bisa juga klik langsung di peta, lalu tekan Simpan / Enter (Esc = batal)"}</div></div><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn btn-ghost btn-sm" id="cancelPlace" type="button">Batal</button><button class="btn btn-grad btn-sm" id="okPlace" type="button">Simpan</button></div>`;
  $("#cancelPlace").onclick=()=>{S.placing=null;renderBanner();drawPts()};
  $("#okPlace").onclick=async e=>{e.currentTarget.disabled=true;await placeAt(map.getCenter())};
}
function crossMode(){return true}
document.addEventListener("keydown",e=>{
  if(e.repeat)return;const t=e.target;if(t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.tagName==="SELECT"||t.isContentEditable))return;
  if(!S.placing){
    if(e.key!=="Enter"||!map||!popup||!popFor||(t&&t.tagName==="BUTTON"))return;
    const el=popup.getElement(),b=el&&el.querySelector('[data-act="fix"]');if(b&&!b.disabled){e.preventDefault();b.click()}
    return}
  if(e.key==="Enter"){const b=$("#okPlace");if(b&&!b.disabled){e.preventDefault();b.click()}}
  else if(e.key==="Escape"){const b=$("#cancelPlace");if(b){e.preventDefault();b.click()}}
});
function placeTap(latlng){map.panTo(latlng,{animate:!MOBILE()?false:true,duration:.3})}
async function placeAt(latlng){
  if(!inPoly(latlng.lng,latlng.lat,geomOf(petaOf(S.sel)))){toast("Tanda ＋ di luar batas SLS. Geser ke dalam garis merah.");const b=$("#okPlace");if(b)b.disabled=false;return}
  const p=ptById(S.placing),c=S.corr[p.id];
  const ok=await save(p,{jenis:"pindah",lat:latlng.lat,lng:latlng.lng,note:c?c.note:""},{silent:true});
  if(!ok){const b=$("#okPlace");if(b)b.disabled=false;return}
  S.placing=null;S.focus=null;renderBanner();drawPts();styleMarkers();
}

/* ---------- Panel daftar ---------- */
function toggleSheet(min){
  const sh=$("#sheet");const h0=sh.offsetHeight;
  S.minSheet=min;renderSheet(min?null:true);
  const h1=sh.offsetHeight;sh.style.height=h0+"px";void sh.offsetHeight;sh.style.height=h1+"px";
  const done=()=>{sh.style.height="";sh.removeEventListener("transitionend",done)};sh.addEventListener("transitionend",done);setTimeout(done,520);
}
const KEND=[["tidak_di_peta","Titik tidak ada di peta scan"],["dobel","Titik bangunan di peta scan dobel"],["catatan","Tambah catatan / kendala lain"]];
const jenisTxt=c=>c.jenis==="dobel"?`Dobel ${c.jumlah||2}× di peta scan`:JENIS[c.jenis];
function tanpaForm(ed){return ed?`<div class="kend" style="margin:0 0 8px;border-color:var(--line2)"><b style="font-size:12px">+ Titik bangunan tidak ada di scan</b><small class="muted">Nomor yang ada di gambar scan tetapi tidak punya titik digital. Pisahkan dengan koma.</small><div class="row" style="gap:6px;flex-wrap:nowrap"><input class="field" id="tanpaNo2" inputmode="numeric" placeholder="mis. 13,15,17" style="flex:1;min-width:0"><button class="btn btn-grad btn-sm" id="tanpaBtn" type="button">Simpan</button></div></div>`:""}
function rowStatus(p,c){if(!c)return p.far?"Belum dicek · nomor sama berjauhan":"Belum dicek";return jenisTxt(c)+(c.note&&c.jenis!=="catatan"?" · ada catatan":"")+" · "+esc(nameOf(c.by))}
function liHtml(p,ed){const c=S.corr[p.id],ok=isOk(c),kd=isKendala(c),open=S.kend&&S.kend.id===p.id;
  return `<div class="li li2 ${ok?"is-ok":""} ${kd?"is-kd":""}" data-p="${esc(p.id)}" role="button" tabindex="0" ${p.id===S.focus?'style="border-color:var(--line2)"':""}>
    <span class="no ${c&&c.jenis==="pindah"?"new":(p.far?"warn":"")}">${esc(+p.no||p.no)}</span>
    <span class="txt"><b>${esc(ptTitle(p,p.kk?"Bangunan tempat tinggal":"Bangunan"))}</b><small class="${ok?"st-ok":kd?"st-kd":""}">${rowStatus(p,c)}</small></span>
    ${ed?`<span class="li-acts"><button class="ic-ok ${ok?"on":""}" data-ok="${esc(p.id)}" type="button" aria-label="Sudah benar" title="Sudah benar">✓</button><button class="ic-kd ${kd||open?"on":""}" data-kd="${esc(p.id)}" type="button" aria-label="Ada kendala" title="Ada kendala">!</button></span>`:""}
  </div>${open?kendHtml(p,c):""}`}
function kendHtml(p,c){const k=S.kend;
  return `<div class="kend a-down" data-kp="${esc(p.id)}"><div class="kend-opts">${KEND.map(([v,l])=>`<button type="button" class="chip ${k.j===v?"on":""}" data-kj="${v}">${l}</button>`).join("")}</div>
    ${k.j==="dobel"?`<label class="row" style="gap:8px;flex-wrap:nowrap;font-size:12px">Ditulis berapa kali di peta scan?<input class="field" id="kendJml" type="number" min="2" max="20" value="${k.jml||2}" style="width:70px"></label>`:""}
    <textarea class="field" id="kendNote" placeholder="${k.j==="catatan"?"Jelaskan kendalanya":k.j==="dobel"?"Keterangan, mis. di sebelah no. 15 dan no. 17":"Catatan (boleh dikosongkan)"}">${esc(k.note||"")}</textarea>
    <div class="row" style="justify-content:flex-end;gap:6px"><button class="btn btn-ghost btn-sm" data-kc type="button">Batal</button><button class="btn btn-grad btn-sm" data-ks type="button" ${k.j?"":"disabled"}>Simpan</button></div></div>`}
async function syncDone(s){
  const pts=S.pts[s];if(!pts||!pts.length||!canEdit(s))return;
  const all=pts.every(p=>isOk(S.corr[p.id])),cur=!!(S.status[s]&&S.status[s].selesai);
  if(all===cur)return;
  const{data,error}=await sb.from("sls_status").upsert({idsubsls:s,selesai:all,oleh:S.me.email,at:new Date().toISOString()}).select().single();
  if(!error){S.status[s]=data;if(all)toast("Semua titik sudah benar — SLS ini dinyatakan beres.",3200)}
}
async function markEmptyOk(s,on){
  const ok=await confirmBox(on?"Nyatakan SLS ini sudah benar?":"Batalkan status beres?",on?"SLS ini tidak punya titik bangunan (mis. sawah/kebun). Pastikan di peta scan memang tidak ada bangunan.":"SLS ini akan kembali berstatus <b>Belum dicek</b>.",on?"Ya, sudah benar":"Ya, batalkan");
  if(!ok)return;
  const{data,error}=await sb.from("sls_status").upsert({idsubsls:s,selesai:on,oleh:S.me.email,at:new Date().toISOString()}).select().single();
  if(error){toast("Gagal: "+error.message);return}
  S.status[s]=data;renderSheet();toast(on?"SLS tanpa bangunan dinyatakan sudah benar.":"Status beres dibatalkan.");
}
async function markAllOk(s){
  const pts=S.pts[s]||[];if(!pts.length)return markEmptyOk(s,true);
  const todo=pts.filter(p=>!S.corr[p.id]),kd=pts.filter(p=>isKendala(S.corr[p.id])).length;
  if(!todo.length&&kd){toast(`Masih ada ${kd} titik dengan kendala. Ganti ke ✓ jika sudah benar.`,3800);return}
  const sisa=(S.temuan[s]||[]).filter(t=>!t.jawaban).length;
  const ok=await confirmBox("Nyatakan semua titik sudah benar?",`${todo.length} titik yang belum dicek akan ditandai <b>Sudah benar</b>.${kd?` ${kd} titik dengan kendala tetap seperti semula.`:""}${sisa?`<br>Masih ada ${sisa} temuan admin belum dijawab.`:""}`,"Ya, semua benar");
  if(!ok)return;
  const rows=todo.map(p=>({assignment_id:p.id,idsubsls:p.sls,no_bang:p.no,unique_bang:p.ub,jenis:"benar",lon:null,lat:null,catatan:null,oleh_email:S.me.email,status:"ok"}));
  for(let i=0;i<rows.length;i+=500){const{data,error}=await sb.from("koreksi").upsert(rows.slice(i,i+500),{onConflict:"assignment_id"}).select();if(error){toast("Gagal: "+error.message);return}data.forEach(r=>(S.corr[r.assignment_id]=corrFromRow(r),S._corrVer=(S._corrVer||0)+1))}
  await syncDone(s);drawPts();renderSheet();toast(`${rows.length} titik ditandai sudah benar.`);
}
function renderSheet(anim){
  const sh=$("#sheet");if(!sh||!S.sel)return;
  const s=S.sel,t=slsStat(s),inf=S.sls[s],pts=ptsOf(s),tem=S.temuan[s]||[];
  sh.classList.toggle("min",S.minSheet);
  const bar=`<button class="sheet-bar" id="sheetBar" type="button" aria-expanded="${!S.minSheet}">
      <div class="t"><b>${esc(inf.nmsls||s)}</b><div class="row" style="gap:5px;margin-top:3px"><span class="pill p-blue">${t.n} titik</span><span class="pill p-ok">${t.benar} benar</span><span class="pill p-new">${t.salah} perbaikan</span>${t.tem-t.dij?`<span class="pill p-mag">${t.tem-t.dij} temuan</span>`:""}</div></div>
      <span class="icon-btn">${ICON.down}</span></button>`;
  const ed=canEdit(s);
  let body="",bodyCls=anim===true?"a-up":"";
  if(!S.minSheet){
    if(!S.pts[s]){body=`<div style="display:grid;gap:6px;padding-top:10px"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>`}
    else if(S.detail&&ptById(S.detail)){const p=ptById(S.detail),c=S.corr[p.id];bodyCls=anim?"a-inR":"";
      const info=p.info&&typeof p.info==="object"?Object.entries(p.info).filter(([k,v])=>v!==null&&v!==""&&!/^(kd|nm)(prov|kab|kec|desa|sls)$|latitude|longitude|level_6|idsubsls|flag_/i.test(k)):[];
      body=`<div style="display:grid;gap:8px;padding-top:10px"><button class="btn btn-ghost btn-sm" id="backList" type="button" style="justify-self:start">← Daftar</button>
        <div class="row" style="gap:10px;flex-wrap:nowrap"><span class="no ${p.far?"warn":""}" style="font-size:15px;padding:5px 8px">${esc(+p.no||p.no)}</span><div style="min-width:0"><b>${esc(ptTitle(p,"Bangunan nomor "+(+p.no||p.no)))}</b><div class="mono dim" style="font-size:10.5px">${esc(p.ub)}</div></div></div>
        ${p.kel&&p.kel.length?`<div class="kel"><div class="eyebrow">Keluarga di bangunan ini</div>${p.kel.map((k,i)=>`<div class="kel-r"><span class="mono dim">${i+1}</span><b>${esc(k.n||"—")}</b><span><small class="muted">Jml angg keluarga</small> ${esc(k.a??"—")}</span><span><small class="muted">Status bangunan</small> ${esc(k.s||"—")}</span></div>`).join("")}</div>`:""}
        <dl class="kv"><dt>Keluarga</dt><dd>${p.kk?"Ada":"Tidak ada"}</dd><dt>Usaha</dt><dd>${esc(p.usaha)}</dd><dt>Kode bangunan</dt><dd>${esc(p.kb)}</dd><dt>Koordinat asli</dt><dd class="mono" style="font-size:11px">${p.y.toFixed(6)}, ${p.x.toFixed(6)}</dd>${c?`<dt>Status</dt><dd>${esc(JENIS[c.jenis])} · ${esc(nameOf(c.by))} · ${esc(tgl(c.at))}</dd>`:""}${c&&c.note?`<dt>Catatan</dt><dd>${esc(c.note)}</dd>`:""}${S.riw&&S.riw[p.id]?`<dt>Riwayat terakhir</dt><dd>${esc(JENIS[S.riw[p.id].jenis]||"")} oleh ${esc(nameOf(S.riw[p.id].oleh_email))} · ${esc(tgl(S.riw[p.id].waktu))} · digabung ${esc(tgl(S.riw[p.id].digabung_at))}</dd>`:""}${c&&c.lat!=null?`<dt>Koordinat baru</dt><dd class="mono" style="font-size:11px;color:var(--warn)">${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}</dd>`:""}
        ${info.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(/nik/i.test(k)?maskNik(v):v)}</dd>`).join("")}<dt>assignment_id</dt><dd class="mono" style="font-size:10px">${esc(p.aid)}</dd></dl>
        <small class="dim">Data titik asli tidak bisa diubah. Perbaikan disimpan di layer terpisah (titik kuning).</small></div>`;
    } else if(!pts.length&&!tem.length){
      body=`<div class="empty">SLS ini tidak punya titik bangunan (mis. sawah/kebun).</div>
      ${ed?`<button class="btn ${t.done?"btn-done":"btn-grad"}" id="doneBtn" type="button" style="width:100%">${t.done?"✓ SLS ini sudah benar (tidak ada bangunan)":"SLS ini sudah benar (tidak ada bangunan)"}</button>`:(t.done?`<div class="pill p-ok" style="justify-self:center">✓ SLS ini sudah dicek, tidak ada bangunan</div>`:"")}`;
    } else {
      if(anim==="back")bodyCls="a-inL";
      const list=[...pts].sort((a,b)=>(b.far-a.far)||String(a.no).localeCompare(String(b.no)));
      body=`<div class="tabs"><button type="button" class="chip ${S.tab==="titik"?"on":""}" data-t="titik">Titik (${pts.length})</button><button type="button" class="chip ${S.tab==="temuan"?"on":""}" data-t="temuan">Temuan admin (${t.tem-t.dij})</button>${isAdmin()?`<button type="button" class="chip ${S.tab==="ai"?"on":""}" data-t="ai">✦ AI</button>`:""}</div>
      <div class="${anim==="tab"?(S.tab==="temuan"?"a-inR":"a-inL"):""}">${S.tab==="ai"?aiHtml(s):S.tab==="titik"?(list.length?`<div class="list">${list.map(p=>liHtml(p,ed)).join("")}</div>`:`<div class="empty">SLS ini tidak punya titik bangunan.</div>`):(tanpaForm(ed)+(tem.length?`<div class="list">${tem.map(x=>{const lab=TEM[x.jenis]||[x.jenis,"mag",""];
        return `<div class="li" style="display:grid;gap:6px"><div class="row" style="gap:9px;flex-wrap:nowrap"><span class="no ${lab[1]}">${esc(+x.no_bang||x.no_bang)}</span><span class="txt"><b>${lab[0]}</b><small>${esc(x.keterangan||lab[2])}</small></span></div>
         ${x.jawaban?`<div class="row between"><small class="muted">Jawaban: ${esc(x.jawaban)} — ${esc(nameOf(x.dijawab_oleh))}</small><button class="link" data-reans="${x.id}" type="button" style="font-size:11px;color:var(--muted);text-decoration:underline">ubah</button></div>`:`<div class="row" style="gap:6px;flex-wrap:nowrap"><input class="field ans" data-i="${x.id}" placeholder="Jawaban singkat" style="flex:1;min-width:0"><button class="btn btn-grad btn-sm" data-ans="${x.id}" type="button">Kirim</button></div>`}</div>`}).join("")}</div>`:`<div class="empty">Tidak ada temuan admin untuk SLS ini.</div>`))}</div>
      ${ed?`<button class="btn ${t.done?"btn-done":"btn-grad"}" id="doneBtn" type="button" style="width:100%">${t.done?(pts.length?"✓ SLS ini sudah saya cek, semua benar":"✓ SLS ini sudah benar (tidak ada bangunan)"):(pts.length?"Nyatakan SLS ini sudah beres (semua benar)":"SLS ini sudah benar (tidak ada bangunan)")}</button>`:(t.done?`<div class="pill p-ok" style="justify-self:center">✓ SLS ini sudah dicek, ${pts.length?"semua benar":"tidak ada bangunan"}</div>`:"")}`;
    }
  }
  const ob=sh.querySelector(".sheet-body"),keep=ob&&!anim&&S._shKey===s+"|"+S.tab+"|"+(S.detail||"")?ob.scrollTop:0;
  sh.innerHTML=bar+`<div class="sheet-body ${bodyCls}">${body}</div>`;
  S._shKey=s+"|"+S.tab+"|"+(S.detail||"");if(keep){const nb=sh.querySelector(".sheet-body");if(nb)nb.scrollTop=keep}
  const fabs=$("#fabs");if(fabs)requestAnimationFrame(()=>fabs.style.setProperty("--fab-b",(MOBILE()?(S.minSheet?sh.querySelector(".sheet-bar").offsetHeight:Math.min(sh.scrollHeight,innerHeight*.58))+22:20)+"px"));
  $("#sheetBar").onclick=()=>toggleSheet(!S.minSheet);
  if(S.tab==="ai"&&!isAdmin())S.tab="titik";drawAi();
  if(S.minSheet)return;
  if(S.tab==="ai")bindAi(s);
  const bl=$("#backList");if(bl)bl.onclick=()=>{S.detail=null;renderSheet("back")};
  sh.querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>{if(S.tab===b.dataset.t)return;S.tab=b.dataset.t;renderSheet("tab")});
  sh.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>{const p=ptById(b.dataset.p);S.draft=null;S.kend=null;
    if(MOBILE())toggleSheet(true);
    map.flyTo([p.y,p.x],Math.max(map.getZoom(),19),{duration:.7,easeLinearity:.2});map.once("moveend",()=>openPop(p))});
  sh.querySelectorAll("[data-ans]").forEach(b=>b.onclick=async()=>{if(!canEdit(s)){toast("SLS ini hanya bisa dilihat.");return}const inp=sh.querySelector(`.ans[data-i="${b.dataset.ans}"]`);const v=inp.value.trim();if(!v){toast("Isi jawaban dulu.");return}
    b.disabled=true;const{data,error}=await sb.from("temuan").update({jawaban:v,dijawab_oleh:S.me.email,dijawab_at:new Date().toISOString()}).eq("id",+b.dataset.ans).select().single();
    if(error){toast("Gagal: "+error.message);b.disabled=false;return}
    const arr=S.temuan[s];arr[arr.findIndex(x=>x.id===data.id)]=data;toast("Jawaban terkirim ke admin.");renderSheet()});
  sh.querySelectorAll("[data-reans]").forEach(b=>b.onclick=()=>{const arr=S.temuan[s];const x=arr.find(y=>y.id===+b.dataset.reans);x._old=x.jawaban;x.jawaban=null;renderSheet()});
  const db=$("#doneBtn");if(db)db.onclick=async()=>{
    if(!canEdit(s)){toast("SLS ini hanya bisa dilihat.");return}
    if(t.done){if(!pts.length){await markEmptyOk(s,false);return}toast("SLS ini sudah beres. Jika ada kendala, tekan ! pada nomor bangunannya.",3500);return}
    await markAllOk(s);
  };
  sh.querySelectorAll("[data-ok]").forEach(b=>b.onclick=async ev=>{ev.stopPropagation();const p=ptById(b.dataset.ok),c=S.corr[p.id];
    if(isOk(c)){if(c.jenis==="pindah")toast("Lokasi titik ini sudah diperbaiki (dihitung benar).");return}
    b.disabled=true;S.kend=null;await save(p,{jenis:"benar",note:c?c.note:""},{silent:true});await syncDone(s);renderSheet()});
  sh.querySelectorAll("[data-kd]").forEach(b=>b.onclick=ev=>{ev.stopPropagation();const p=ptById(b.dataset.kd),c=S.corr[p.id];
    S.kend=S.kend&&S.kend.id===p.id?null:{id:p.id,j:isKendala(c)?c.jenis:"",note:c?c.note:"",jml:c&&c.jumlah||2};renderSheet()});
  sh.querySelectorAll("[data-kj]").forEach(b=>b.onclick=ev=>{ev.stopPropagation();S.kend.j=b.dataset.kj;S.kend.note=$("#kendNote").value;const jm=$("#kendJml");if(jm)S.kend.jml=+jm.value||2;renderSheet();const t=$("#kendNote");t&&t.focus()});
  const tb=$("#tanpaBtn");if(tb)tb.onclick=async()=>{tb.disabled=true;if(!(await addTanpa(s,$("#tanpaNo2").value)))tb.disabled=false};
  const kc=sh.querySelector("[data-kc]");if(kc)kc.onclick=ev=>{ev.stopPropagation();S.kend=null;renderSheet()};
  const ks=sh.querySelector("[data-ks]");if(ks)ks.onclick=async ev=>{ev.stopPropagation();const k=S.kend,p=ptById(k.id),note=$("#kendNote").value.trim();
    if(k.j==="catatan"&&!note){toast("Tulis penjelasan kendalanya.");return}
    const jm=$("#kendJml");ks.disabled=true;const okk=await save(p,{jenis:k.j,note,jumlah:jm?+jm.value||2:null},{silent:true});if(okk){S.kend=null;await syncDone(s);renderSheet()}else ks.disabled=false};
  sh.querySelectorAll(".kend").forEach(el=>el.onclick=ev=>ev.stopPropagation());
}

/* ---------- Koreksi ---------- */
function corrCard(c){return `<article class="corr2">
      <div class="row between" style="gap:8px;flex-wrap:nowrap"><div class="row" style="gap:9px;flex-wrap:nowrap;min-width:0"><span class="no ${c.jenis==="pindah"?"new":"mag"}">${esc(+c.no||c.no)}</span><div style="min-width:0"><b>${esc(jenisTxt(c))}</b><div class="dim" style="font-size:10.5px">oleh ${esc(nameOf(c.by))} · ${esc(tgl(c.at))}</div></div></div>
      <button class="btn btn-ghost btn-sm" data-go="${esc(c.aid)}" data-s="${c.sls}" type="button">Lihat di peta</button></div>
      ${c.note?`<div style="font-size:12px">“${esc(c.note)}”</div>`:""}
      ${c.lat!=null?`<div class="muted mono" style="font-size:10.5px">lokasi baru → ${(+c.lat).toFixed(6)}, ${(+c.lng).toFixed(6)}</div>`:""}
    </article>`}
function vKoreksi(){
  const list=Object.values(S.corr).filter(c=>c.jenis!=="benar");
  const F=[["semua","Semua"],["pindah","Lokasi diperbaiki"],["tidak_di_peta","Tidak ada di peta scan"],["dobel","Dobel"],["catatan","Catatan / kendala"]];
  const f=S.kf||"semua";const shown=list.filter(c=>f==="semua"||c.jenis===f);
  const by={};shown.forEach(c=>(by[c.sls]=by[c.sls]||[]).push(c));
  Object.values(by).forEach(a=>a.sort((x,y)=>String(x.no).localeCompare(String(y.no))));
  const ids=Object.keys(by).filter(id=>S.sls[id]).sort();
  const groups=groupsFor(ids);const KO=S.kopen=S.kopen||{};if(groups.length===1)KO[groups[0].k]=true;
  const cnt=a=>a.reduce((n,id)=>n+by[id].length,0);
  const slsHtml=d=>d.ids.map(id=>{const k="s|"+id,open=!!KO[k],sl=S.sls[id];
    return `<section class="group sub sls3 ${open?"open":""}" data-g="${esc(k)}"><button class="group-h" type="button" aria-expanded="${open}"><div class="t"><b>${id.slice(10,14)}${id.slice(14)!=="00"?"."+id.slice(14):""} · ${esc(shortNm(sl.nmsls))}</b><small class="muted">${by[id].length} perbaikan/kendala</small></div><span class="icon-btn chev">${ICON.down}</span></button>
      <div class="group-body"><div><div class="corr-list" data-ids="${id}">${open?by[id].map(corrCard).join(""):""}</div></div></div></section>`}).join("");
  const dusHtml=g=>g.dusun.map(d=>{const k="d|"+d.k,open=!!KO[k];
    return `<section class="group sub ${open?"open":""}" data-g="${esc(k)}"><button class="group-h" type="button" aria-expanded="${open}"><div class="t"><b>${esc(d.title)}</b><small class="muted">${d.ids.length} SLS · ${cnt(d.ids)} perbaikan/kendala</small></div><span class="icon-btn chev">${ICON.down}</span></button>
      <div class="group-body"><div><div class="dusun-list">${open?slsHtml(d):""}</div></div></div></section>`}).join("");
  $("#view").innerHTML=`<div class="scroll"><div class="wrap stagger">
    <div class="hello" style="--i:0"><div><div class="eyebrow">Riwayat perbaikan</div><h1>Perbaikan lokasi & kendala</h1></div></div>
    <div class="row" style="gap:6px;--i:1">${F.map(([k,l])=>`<button class="chip ${f===k?"on":""}" data-f="${k}" type="button">${l} (${k==="semua"?list.length:list.filter(c=>c.jenis===k).length})</button>`).join("")}</div>
    <div id="kgroups" style="--i:2;display:grid;gap:8px">${groups.length?groups.map(g=>{const k="g|"+g.k,open=!!KO[k]||!!KO[g.k];
      return `<section class="glass group ${open?"open":""}" data-g="${esc(k)}"><button class="group-h" type="button" aria-expanded="${open}"><div class="t"><b>${esc(g.title)}</b><small class="muted">${g.ids.length} SLS · ${cnt(g.ids)} perbaikan/kendala</small></div><span class="icon-btn chev">${ICON.down}</span></button>
        <div class="group-body"><div><div class="dusun-list">${open?dusHtml(g):""}</div></div></div></section>`}).join(""):`<div class="glass empty">${list.length?"Tidak ada data dengan pilihan ini.":"Belum ada perbaikan. Buka Peta, ketuk nomor bangunan, lalu pilih \"Perbaiki lokasi\" atau tekan ! di daftar."}</div>`}</div>
  </div></div>`;
  $("#view").querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>{S.kf=b.dataset.f;vKoreksi()});
  const box=$("#kgroups");
  box.onclick=e=>{
    const go=e.target.closest("[data-go]");if(go){setSel(go.dataset.s);S.focus=go.dataset.go;S.draft=null;S.detail=null;S._view=null;go_("peta");return}
    const h=e.target.closest(".group-h");if(!h)return;const sec=h.parentElement,k=sec.dataset.g,inner=sec.querySelector(".group-body .dusun-list,.group-body .corr-list");
    if(inner&&!inner.innerHTML){
      if(k.startsWith("g|")){inner.innerHTML=dusHtml(groups.find(g=>"g|"+g.k===k))}
      else if(k.startsWith("d|")){let dd;groups.some(g=>dd=g.dusun.find(d=>"d|"+d.k===k));inner.innerHTML=slsHtml(dd)}
      else if(k.startsWith("s|")){inner.innerHTML=by[k.slice(2)].map(corrCard).join("")}}
    KO[k]=!KO[k];h.setAttribute("aria-expanded",KO[k]);requestAnimationFrame(()=>sec.classList.toggle("open",KO[k]));
  };
}
const go_=v=>go(v);

/* ---------- Admin ---------- */
const fmtB=b=>b>=1073741824?(b/1073741824).toFixed(2)+" GB":b>=1048576?(b/1048576).toFixed(1)+" MB":Math.round(b/1024)+" KB";
async function loadMem(){
  const box=$("#memBox");if(!box)return;
  const{data:m,error}=await sb.rpc("status_memori");if(!$("#memBox"))return;
  if(error){box.innerHTML=`<small class="muted">Gagal memuat: ${esc(error.message)}</small>`;return}
  const bar=(lab,v,max,sub)=>{const pc=Math.min(100,v/max*100),col=pc>=90?"var(--bad)":pc>=70?"#ffb648":"var(--ok)";
    return `<div style="display:grid;gap:5px"><div class="row between"><b style="font-size:13px">${lab}</b><span class="mono" style="font-size:12px">${fmtB(v)} / ${fmtB(max)} · ${pc.toFixed(1)}%</span></div>
      <div class="prog"><i style="width:${pc}%;background:${col}"></i></div>${sub?`<small class="muted">${sub}</small>`:""}</div>`};
  const tb=(m.tabel||[]).slice(0,4).map(t=>`${esc(t.t)} ${fmtB(t.b)}`).join(" · ");
  box.innerHTML=`<div style="display:grid;gap:12px">
    ${bar("Database",m.db,524288000,"Terbesar: "+tb)}
    ${bar("Penyimpanan file (scan)",m.scan+m.lain,1073741824,`${fmt(m.scan_n)} gambar scan · upload ulang file dengan nama sama otomatis menimpa yang lama`)}
    <div class="row between" style="gap:8px"><small class="muted">${m.yatim_n?`<b>${fmt(m.yatim_n)}</b> gambar scan tidak terpakai (${fmtB(m.yatim)}), mis. dari SLS yang sudah tidak ada.`:"Tidak ada gambar scan yang tidak terpakai ✓"}</small>
      <div class="row" style="gap:6px">${m.yatim_n?`<button class="btn btn-bad btn-sm" id="memClean" type="button">Hapus yang tidak terpakai</button>`:""}<button class="btn btn-ghost btn-sm" id="memRef" type="button">Muat ulang</button></div></div>
  </div>`;
  $("#memRef").onclick=()=>{box.innerHTML='<small class="muted">Memuat…</small>';loadMem()};
  const cl=$("#memClean");if(cl)cl.onclick=async()=>{
    if(!await confirmBox("Hapus gambar scan tidak terpakai?",`${fmt(m.yatim_n)} gambar (${fmtB(m.yatim)}) yang tidak dipakai SLS mana pun akan dihapus permanen.`,"Ya, hapus"))return;
    cl.disabled=true;const{data:paths,error:e1}=await sb.rpc("scan_yatim");if(e1){toast("Gagal: "+e1.message);cl.disabled=false;return}
    for(let i=0;i<paths.length;i+=100){const{error}=await sb.storage.from("scan").remove(paths.slice(i,i+100));if(error){toast("Gagal: "+error.message);break}}
    toast(`${fmt(paths.length)} gambar scan dihapus.`);loadMem()};
}
function renderPeng(){
  const box=$("#pengBox");if(!box)return;const c=S.cfg||CFGDEF;
  const nT=S.slsIds.reduce((a,id)=>a+(S.sls[id].n_titik||0),0),nS=S.slsIds.length;
  box.innerHTML=`<div class="peng-grid">
      <label><small class="muted">Kode kecamatan (7 digit)</small><input class="field mono" id="pgKode" inputmode="numeric" maxlength="7" value="${esc(c.kode_kec)}"></label>
      <label><small class="muted">Nama kecamatan</small><input class="field" id="pgNama" value="${esc(c.nama_kec)}"></label>
      <label><small class="muted">Target jumlah titik</small><input class="field mono" id="pgTT" inputmode="numeric" value="${c.target_titik||""}" placeholder="mis. 36980"></label>
      <label><small class="muted">Target jumlah SLS</small><input class="field mono" id="pgTS" inputmode="numeric" value="${c.target_sls||""}" placeholder="mis. 630"></label>
    </div>
    <div class="row between" style="gap:8px"><small class="muted">Data di server sekarang: ${fmt(nT)} titik · ${fmt(nS)} SLS${nS?` · <button class="link" id="pgSama" type="button" style="font-size:12px;color:var(--cyan);text-decoration:underline">samakan target dengan data ini</button>`:""}</small>
      <button class="btn btn-grad btn-sm" id="pgSave" type="button">Simpan pengaturan</button></div>`;
  const sm=$("#pgSama");if(sm)sm.onclick=()=>{$("#pgTT").value=nT;$("#pgTS").value=nS};
  $("#pgSave").onclick=async e=>{
    const v={kode_kec:$("#pgKode").value.trim(),nama_kec:$("#pgNama").value.trim(),target_titik:parseInt($("#pgTT").value.replace(/\D/g,""))||0,target_sls:parseInt($("#pgTS").value.replace(/\D/g,""))||0,updated_at:new Date().toISOString()};
    if(!/^\d{7}$/.test(v.kode_kec)){toast("Kode kecamatan harus 7 angka, mis. 3508050.");return}
    if(!v.nama_kec){toast("Isi nama kecamatan.");return}
    if(nS&&!S.slsIds.every(id=>id.startsWith(v.kode_kec))&&!await confirmBox("Kode tidak cocok dengan data",`SLS yang sudah ada di server tidak diawali <b>${esc(v.kode_kec)}</b>. Tetap simpan?`,"Tetap simpan"))return;
    e.currentTarget.disabled=true;const{error}=await sb.from("pengaturan").update(v).eq("id",1);e.currentTarget&&(e.currentTarget.disabled=false);
    if(error){toast("Gagal: "+error.message);return}
    S.cfg={...S.cfg,...v};document.title="Cek Titik Bangunan · "+NAMA_KEC();toast("Pengaturan kecamatan disimpan.");vAdmin()};
}
function vAdmin(){
  if(!isAdmin()){go("beranda");return}
  const pml=Object.values(S.people).filter(v=>v.peran==="PML").sort((a,b)=>a.nama.localeCompare(b.nama));
  const adm=Object.values(S.people).filter(v=>v.admin),kor=Object.values(S.people).filter(v=>v.akses==="edit_kec").sort((a,b)=>a.nama.localeCompare(b.nama));
  const rows=pml.flatMap(pv=>[pv,...Object.values(S.people).filter(v=>v.peran==="PPL"&&v.pml_email===pv.email).sort((a,b)=>a.nama.localeCompare(b.nama))]);
  const nSlsOf=e=>S.slsIds.filter(id=>S.sls[id].ppl_email===e||(S.people[S.sls[id].ppl_email]||{}).pml_email===e).length;
  const totT=S.slsIds.reduce((a,id)=>a+(S.sls[id].n_titik||0),0),nScan=Object.values(S.scans).reduce((a,v)=>a+Object.keys(v).length,0);
  $("#view").innerHTML=`<div class="scroll"><div class="wrap stagger">
    <div class="hello" style="--i:0"><div><div class="eyebrow">Admin</div><h1>Pengelolaan data</h1></div></div>
    <section style="display:grid;gap:10px;--i:1">
      <div class="section-h"><h2>Impor data dari QGIS</h2><small class="muted">Data di server: ${fmt(totT)} titik · ${S.slsIds.length} SLS · ${nScan} lembar scan</small></div>
      <div class="imp">
        <div class="glass card"><div class="row between"><b>Titik bangunan</b><span class="pill p-blue">GeoJSON</span></div>
          <small class="muted">File <span class="mono">${KODE().slice(0,4)}_geotagging_koreksi.geojson</span>. Harus tepat <b>${TARGET_TITIK_()?fmt(TARGET_TITIK_()):"(isi target dulu)"}</b> titik dan assignment_id unik. Perbaikan petugas tetap menempel.</small>
          <label class="btn btn-ghost btn-sm filebtn">Pilih file titik…<input type="file" accept=".geojson,.json" multiple data-imp="titik"></label></div>
        <div class="glass card"><div class="row between"><b>Batas SLS</b><span class="pill p-blue">GeoJSON</span></div>
          <small class="muted">File <span class="mono">${KODE()}_sls_2026-1.geojson</span>. Harus tepat <b>${TARGET_SLS_()||"(isi target dulu)"}</b> SLS. Alokasi PPL tidak berubah.</small>
          <label class="btn btn-ghost btn-sm filebtn">Pilih file SLS…<input type="file" accept=".geojson,.json" data-imp="sls"></label></div>
        <div class="glass card"><div class="row between"><b>Scan peta + JGW</b><span class="pill p-blue">JPG + JGW</span></div>
          <small class="muted">Pilih semua file di <span class="mono">01_Rename Scan Peta</span> (boleh sebagian). Gambar diperkecil otomatis sebelum diunggah. Jika hanya memilih .jgw, posisi scan saja yang diperbarui.</small>
          <label class="btn btn-ghost btn-sm filebtn">Pilih file scan…<input type="file" accept=".jpg,.jpeg,.png,.jgw,.pgw" multiple data-imp="scan"></label></div>
        <div class="glass card"><div class="row between"><b>Temuan admin</b><span class="pill p-blue">CSV</span></div>
          <small class="muted"><span class="mono">nomor_di_peta_tanpa_titik</span> → temuan SLS. <span class="mono">titik_tidak_ada_di_peta</span> & <span class="mono">nomor_dobel_di_peta</span> → kendala di titiknya (tidak menimpa isian petugas).</small>
          <div class="row" style="gap:6px"><label class="btn btn-ghost btn-sm filebtn">Pilih file CSV…<input type="file" accept=".csv" multiple data-imp="temuan"></label><button class="btn btn-grad btn-sm" id="dlTem" type="button">Unduh temuan + jawaban</button></div></div>
        <div class="glass card"><div class="row between"><b>Alokasi petugas</b><span class="pill p-blue">CSV</span></div>
          <small class="muted">Unduh sheet <span class="mono">Alokasi SLS</span> sebagai CSV. Kolom yang dipakai: id_subsls, Nama PPL, Email PPL, Nama PML, Email PML.</small>
          <label class="btn btn-ghost btn-sm filebtn">Pilih file CSV…<input type="file" accept=".csv" data-imp="alokasi"></label></div>
        <div class="glass card"><div class="row between"><b>Unduh perbaikan</b><span class="pill p-new">untuk QGIS</span></div>
          <small class="muted">GeoJSON titik perbaikan (lokasi baru) beserta assignment_id, status, dan catatan, untuk di-join ke layer asli.</small>
          <div class="row"><button class="btn btn-grad btn-sm" type="button" id="dlAll">Unduh semua perbaikan</button></div></div>
      </div>
      <div class="glass card" id="impBox" hidden><div class="row between"><b id="impTitle">Mengimpor…</b><span class="mono dim" id="impPct"></span></div><div class="prog"><i id="impBar"></i></div><pre class="log" id="impLog"></pre></div>
    </section>
    <section style="display:grid;gap:10px;--i:2">
      <div class="section-h"><h2>Status memori Supabase</h2><small class="muted">Batas paket gratis: database 500 MB · penyimpanan file 1 GB</small></div>
      <div class="glass card" id="memBox"><small class="muted">Memuat…</small></div>
    </section>
    <section style="display:grid;gap:10px;--i:2">
      <div class="section-h"><h2>Pengaturan kecamatan</h2><small class="muted">Dipakai untuk memeriksa file impor (jumlah titik & SLS harus sama) dan nama file unduhan.</small></div>
      <div class="glass card" id="pengBox"></div>
    </section>
    <section style="display:grid;gap:10px;--i:2">
      <div class="section-h"><h2>Pengecekan AI (Gemini)</h2><small class="muted">Untuk tombol "✦ AI" di panel SLS pada halaman Peta: AI membaca nomor tulisan tangan di scan dan membandingkannya dengan titik digital.</small></div>
      <div class="glass card" id="aiBox"></div>
    </section>
    <section style="display:grid;gap:10px;--i:2">
      <div class="section-h"><h2>Koordinator & pembantu perbaikan</h2><small class="muted">Bisa melihat dan mengedit titik seluruh kecamatan, tanpa menu Admin. Menu Admin dikunci untuk email pemilik.</small></div>
      <div class="glass card">${kor.length?kor.map(a=>`<div class="row between"><span><b>${esc(a.nama)}</b> <span class="dim mono">${esc(a.email)}</span>${a.peran==="PPL"||a.peran==="PML"?` <span class="pill p-mute">${a.peran}</span>`:""}</span><button class="btn btn-bad btn-sm" data-unkor="${esc(a.email)}" type="button">Cabut</button></div>`).join(""):`<small class="muted">Belum ada.</small>`}
        <div class="row" style="flex-wrap:nowrap"><input class="field" id="korEmail" placeholder="email Google" style="flex:1;min-width:0"><input class="field" id="korName" placeholder="nama" style="flex:1;min-width:0"><button class="btn btn-grad btn-sm" id="addKor" type="button">Tambah</button></div>
        <small class="muted">Admin: ${adm.map(a=>esc(a.nama)+" <span class=\"dim mono\">"+esc(a.email)+"</span>").join(" · ")}</small></div>
    </section>
    <section style="display:grid;gap:10px;--i:3">
      <div class="section-h"><h2>Petugas</h2><small class="muted">${pml.length} PML · ${Object.values(S.people).filter(v=>v.peran==="PPL").length} PPL · ubah nama atau email lalu tekan Simpan · akses khusus langsung tersimpan saat dipilih</small></div>
      <div class="tbl-wrap glass" style="max-height:420px"><table><thead><tr><th>Wilayah</th><th>Nama</th><th>Peran</th><th>Email login</th><th></th><th>Akses khusus</th></tr></thead><tbody>
        ${rows.map(r=>`<tr${r.peran==="PML"?' style="background:var(--soft)"':""}><td class="mono">${nSlsOf(r.email)} SLS</td><td><input class="field nm" data-f="nama" value="${esc(r.nama)}" data-old="${esc(r.nama)}" aria-label="Nama ${esc(r.nama)}"${r.peran==="PML"?' style="font-weight:700"':""}></td><td>${r.peran}${r.admin?" · admin":""}</td><td><input class="field" data-f="email" value="${esc(r.email)}" data-old="${esc(r.email)}" aria-label="Email ${esc(r.nama)}"></td><td><button class="btn btn-ghost btn-sm" data-saveem="${esc(r.email)}" type="button">Simpan</button></td><td><select class="field" data-akses="${esc(r.email)}" aria-label="Akses khusus ${esc(r.nama)}" style="min-width:190px">${Object.entries(AKSES).map(([k,l])=>`<option value="${k}" ${(r.akses||"")===k?"selected":""}>${l}</option>`).join("")}</select></td></tr>`).join("")}
      </tbody></table></div>
    </section>
  </div></div>`;
  $("#view").querySelectorAll("input[data-imp]").forEach(inp=>inp.onchange=()=>{const files=[...inp.files];inp.value="";if(files.length)runImport(inp.dataset.imp,files)});
  $("#dlAll").onclick=()=>exportKoreksi(false);$("#dlTem").onclick=exportTemuan;loadMem();renderPeng();renderAiCfg();
  $("#view").querySelectorAll("[data-akses]").forEach(sel=>sel.onchange=async()=>{
    const em=sel.dataset.akses,v=sel.value||null;sel.disabled=true;
    const{error}=await sb.from("petugas").update({akses:v}).eq("email",em);sel.disabled=false;
    if(error){toast("Gagal: "+error.message);sel.value=(S.people[em]||{}).akses||"";return}
    if(S.people[em])S.people[em].akses=v;toast(`Akses khusus ${nameOf(em)}: ${AKSES[v||""]}. Berlaku saat petugas membuka ulang aplikasi.`,3500)});
  $("#view").querySelectorAll("[data-saveem]").forEach(b=>{const tr=b.closest("tr"),nmI=tr.querySelector('[data-f="nama"]'),emI=tr.querySelector('[data-f="email"]');
    const dirty=()=>{const d=nmI.value.trim()!==nmI.dataset.old||emI.value.trim().toLowerCase()!==emI.dataset.old;b.classList.toggle("btn-grad",d);b.classList.toggle("btn-ghost",!d)};
    [nmI,emI].forEach(i=>{i.oninput=dirty;i.onkeydown=e=>{if(e.key==="Enter")b.click()}});
    b.onclick=async()=>{
    const old=b.dataset.saveem,nw=emI.value.trim().toLowerCase(),nm=nmI.value.trim().replace(/\s+/g," "),upd={};
    if(!nm){toast("Nama tidak boleh kosong.");return}
    if(nm!==nmI.dataset.old)upd.nama=nm;
    if(nw!==old){if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nw)){toast("Format email tidak valid.");return}upd.email=nw}
    if(!Object.keys(upd).length){toast("Tidak ada perubahan.");return}
    b.disabled=true;const{error}=await sb.from("petugas").update(upd).eq("email",old);
    if(error){toast("Gagal: "+error.message);b.disabled=false;return}
    if(upd.nama&&old===S.me.email)S.me.nama=upd.nama;
    toast(upd.email&&upd.nama?"Nama dan email diganti. Petugas masuk dengan email baru.":upd.email?"Email diganti. Petugas masuk dengan email baru.":"Nama petugas diperbarui.");await loadAll();vAdmin()}});
  $("#addKor").onclick=async()=>{const e=$("#korEmail").value.trim().toLowerCase(),n=$("#korName").value.trim();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)){toast("Isi email Google yang valid.");return}
    const ex=S.people[e];if(!ex&&!n){toast("Isi nama juga.");return}
    const{error}=ex?await sb.from("petugas").update({akses:"edit_kec"}).eq("email",e):await sb.from("petugas").insert({email:e,nama:n,peran:"KOORDINATOR",akses:"edit_kec"});
    if(error){toast("Gagal: "+error.message);return}toast(`${ex?ex.nama:n} bisa melihat & mengedit seluruh kecamatan.`,3200);await loadAll();vAdmin()};
  $("#view").querySelectorAll("[data-unkor]").forEach(b=>b.onclick=async()=>{const e=b.dataset.unkor,p=S.people[e];
    if(!await confirmBox("Cabut akses?",`<b>${esc(p.nama)}</b> tidak bisa lagi melihat & mengedit seluruh kecamatan.${p.peran==="KOORDINATOR"?" Ia tidak bisa masuk aplikasi lagi.":""} Perbaikan yang sudah ia buat tetap tersimpan.`,"Ya, cabut"))return;
    let error;if(p.peran==="KOORDINATOR"){({error}=await sb.from("petugas").delete().eq("email",e));if(error)({error}=await sb.from("petugas").update({akses:null}).eq("email",e))}
    else({error}=await sb.from("petugas").update({akses:null}).eq("email",e));
    if(error){toast("Gagal: "+error.message);return}toast("Akses dicabut.");await loadAll();vAdmin()});
}

/* ---------- Impor ---------- */
const IMP={log(m){const l=$("#impLog");if(l){l.textContent+=m+"\n";l.scrollTop=l.scrollHeight}},
  set(t,p){const b=$("#impBox");if(b)b.hidden=false;if(t!=null)$("#impTitle").textContent=t;if(p!=null){$("#impBar").style.width=(p*100).toFixed(1)+"%";$("#impPct").textContent=Math.round(p*100)+"%"}}};
let importing=false;
async function runImport(kind,files){
  if(importing){toast("Tunggu impor sebelumnya selesai.");return}
  importing=true;$("#impLog").textContent="";IMP.set("Membaca file…",0);
  addEventListener("beforeunload",warnLeave);
  try{await ({titik:impTitik,sls:impSls,scan:impScan,temuan:impTemuan,alokasi:impAlokasi})[kind](files);await loadAll();S.pts={};S.urls={};S.geoms={}}
  catch(e){console.error(e);IMP.log("GAGAL: "+(e.message||e));IMP.set("Impor gagal",null);toast("Impor gagal: "+(e.message||e),5000)}
  finally{importing=false;removeEventListener("beforeunload",warnLeave)}
}
function warnLeave(e){e.preventDefault();e.returnValue=""}
const readText=f=>f.text();
async function readGeo(files){let feats=[];for(const f of files){IMP.log(`Membaca ${f.name} (${(f.size/1e6).toFixed(1)} MB)…`);const j=JSON.parse(await readText(f));feats=feats.concat(j.features||[])}return feats}
async function upsertBatches(table,rows,size,label,onConflict){
  for(let i=0;i<rows.length;i+=size){
    const part=rows.slice(i,i+size);
    for(let attempt=0;;attempt++){
      const{error}=await sb.from(table).upsert(part,onConflict?{onConflict}:undefined);
      if(!error)break;if(attempt>=2)throw new Error(`${label} baris ${i+1}: ${error.message}`);
      IMP.log(`Ulangi batch ${i+1} (${error.message})…`);await new Promise(r=>setTimeout(r,1500));
    }
    IMP.set(null,Math.min(1,(i+size)/rows.length));
  }
}
const mdist=(a,b)=>Math.hypot((a[0]-b[0])*110000*Math.cos(8*Math.PI/180),(a[1]-b[1])*110000);
async function impTitik(files){
  const feats=await readGeo(files);
  const TT=TARGET_TITIK_();if(!TT)throw new Error("Target jumlah titik belum diisi. Isi dulu di Admin → Pengaturan kecamatan.");
  IMP.log(`Jumlah titik: ${fmt(feats.length)} (target ${fmt(TT)})`);
  if(feats.length!==TT)throw new Error(`Jumlah titik ${fmt(feats.length)}, bukan ${fmt(TT)}. Impor dibatalkan, data lama tetap dipakai.`);
  const lain=feats.filter(f=>!String((f.properties||{}).level_6_full_code||(f.properties||{}).idsubsls_origin||"").startsWith(KODE())).length;
  if(lain)throw new Error(`${fmt(lain)} titik bukan milik Kecamatan ${NAMA_KEC()} (kode SLS tidak diawali ${KODE()}). Impor dibatalkan.`);
  const ids=new Set();for(const f of feats){const a=f.properties&&f.properties.assignment_id;if(!a)throw new Error("Ada titik tanpa assignment_id.");if(ids.has(a))throw new Error("assignment_id dobel: "+a);ids.add(a)}
  IMP.log("assignment_id unik ✓");
  const groups={};for(const f of feats){const p=f.properties;(groups[p.unique_bang]=groups[p.unique_bang]||[]).push(f.geometry.coordinates)}
  const far=new Set();for(const[k,v]of Object.entries(groups))if(v.length>1){let m=0;for(let i=0;i<v.length;i++)for(let j=i+1;j<v.length;j++)m=Math.max(m,mdist(v[i],v[j]));if(m>20)far.add(k)}
  IMP.log(`Nomor bangunan berjauhan (>20 m): ${fmt(far.size)}`);
  const batch="b"+Date.now(),known=new Set(["assignment_id","level_6_full_code","no_bang","unique_bang","kode_bang_value","kk","usaha","nama_usaha_bang"]);
  const per={};
  const rows=feats.map(f=>{const p=f.properties,c=f.geometry.coordinates,sid=p.level_6_full_code||p.idsubsls_origin;
    const info={};for(const[k,v]of Object.entries(p))if(!known.has(k)&&v!==null&&v!=="")info[k]=/nik/i.test(k)?maskNik(v):v;
    const isFar=far.has(p.unique_bang);per[sid]=per[sid]||{n:0,f:0};per[sid].n++;if(isFar)per[sid].f++;
    return{assignment_id:p.assignment_id,idsubsls:sid,no_bang:p.no_bang,unique_bang:p.unique_bang,kode_bang:p.kode_bang_value,kk:+p.kk||0,usaha:+p.usaha||0,nama_usaha:p.nama_usaha_bang||null,lon:c[0],lat:c[1],far:isFar,info,batch}});
  IMP.set("Membaca lokasi titik lama…",0);
  const old={};(await fetchAll(()=>sb.from("titik").select("assignment_id,lon,lat").order("assignment_id"))).forEach(r=>old[r.assignment_id]=[r.lon,r.lat]);
  const moved=new Set(rows.filter(r=>old[r.assignment_id]&&mdist(old[r.assignment_id],[r.lon,r.lat])>0.3).map(r=>r.assignment_id));
  IMP.log(`Titik yang lokasinya berubah dibanding data sebelumnya: ${fmt(moved.size)}`);
  IMP.set("Mengunggah titik…",0);
  await upsertBatches("titik",rows,1000,"Titik");
  IMP.log("Menghapus titik lama yang tidak ada di file baru…");
  const{error:de}=await sb.from("titik").delete().neq("batch",batch);if(de)throw de;
  IMP.set("Memperbarui ringkasan SLS…",0);
  const srows=S.slsIds.map(id=>({idsubsls:id,n_titik:(per[id]||{}).n||0,n_far:(per[id]||{}).f||0}));
  await upsertBatches("sls",srows,700,"Ringkasan SLS");
  // perbaikan lokasi yang sudah digabung di QGIS: garis & titik kuning dihapus, titik kembali biru
  const doneFix=(await fetchAll(()=>sb.from("koreksi").select("*").eq("jenis","pindah").order("assignment_id"))).filter(r=>moved.has(r.assignment_id));
  const now=new Date().toISOString(),rw=doneFix.map(r=>({assignment_id:r.assignment_id,idsubsls:r.idsubsls,jenis:r.jenis,lon:r.lon,lat:r.lat,catatan:r.catatan,oleh_email:r.oleh_email,waktu:r.updated_at,digabung_at:now}));
  for(let i=0;i<rw.length;i+=500){const{error}=await sb.from("riwayat").upsert(rw.slice(i,i+500),{onConflict:"assignment_id"});if(error)throw error}
  // titik yang sudah diperbaiki tetap dihitung benar (centang hijau); catatannya tetap disimpan
  const fixIds=doneFix.map(r=>r.assignment_id);
  for(let i=0;i<fixIds.length;i+=200){const{error}=await sb.from("koreksi").update({jenis:"benar",lon:null,lat:null,status:"ok"}).in("assignment_id",fixIds.slice(i,i+200));if(error)throw error}
  IMP.log(`Perbaikan lokasi yang sudah masuk file baru: ${fmt(doneFix.length)} (garis kuning dihapus, titik tetap tercentang benar)`);
  const nk=await fetchAll(()=>sb.from("koreksi").select("*").order("assignment_id"));S._corrVer=(S._corrVer||0)+1;S.corr={};nk.forEach(r=>(S.corr[r.assignment_id]=corrFromRow(r),S._corrVer=(S._corrVer||0)+1));S.pts={};
  const lost=Object.keys(S.corr).filter(a=>!ids.has(a));
  IMP.log(lost.length?`Perhatian: ${lost.length} perbaikan merujuk titik yang sudah tidak ada.`:"Semua perbaikan petugas masih menempel ✓");
  IMP.set("Impor titik selesai ✓",1);toast("Impor titik selesai.");
}
function dp(P,eps){if(P.length<3)return P;const a=P[0],b=P[P.length-1];let dmax=0,idx=0;for(let i=1;i<P.length-1;i++){const p=P[i],dx=b[0]-a[0],dy=b[1]-a[1],n=Math.hypot(dx,dy)||1e-12,d=Math.abs(dy*p[0]-dx*p[1]+b[0]*a[1]-b[1]*a[0])/n;if(d>dmax){dmax=d;idx=i}}return dmax>eps?dp(P.slice(0,idx+1),eps).slice(0,-1).concat(dp(P.slice(idx),eps)):[a,b]}
function simpRing(r,eps){if(r.length<5)return r;let far=0,md=0;r.forEach((p,i)=>{const d=(p[0]-r[0][0])**2+(p[1]-r[0][1])**2;if(d>md){md=d;far=i}});return dp(r.slice(0,far+1),eps).slice(0,-1).concat(dp(r.slice(far),eps)).map(p=>[+p[0].toFixed(7),+p[1].toFixed(7)])}
async function impSls(files){
  const feats=await readGeo(files);
  const TS=TARGET_SLS_();if(!TS)throw new Error("Target jumlah SLS belum diisi. Isi dulu di Admin → Pengaturan kecamatan.");
  IMP.log(`Jumlah SLS: ${feats.length} (target ${TS})`);
  if(feats.length!==TS)throw new Error(`Jumlah SLS ${feats.length}, bukan ${TS}. Impor dibatalkan.`);
  const lainS=feats.filter(f=>!String((f.properties||{}).idsubsls||"").startsWith(KODE())).length;
  if(lainS)throw new Error(`${lainS} SLS bukan milik Kecamatan ${NAMA_KEC()} (idsubsls tidak diawali ${KODE()}). Impor dibatalkan.`);
  const batch="b"+Date.now(),seen=new Set();
  const rows=feats.map(f=>{const p=f.properties,g=f.geometry;if(!p.idsubsls)throw new Error("Ada poligon tanpa idsubsls.");if(seen.has(p.idsubsls))throw new Error("idsubsls dobel: "+p.idsubsls);seen.add(p.idsubsls);
    const polys=(g.type==="Polygon"?[g.coordinates]:g.coordinates).map(poly=>poly.map(r=>simpRing(r.map(c=>[c[0],c[1]]),0.000003)));
    let x0=999,y0=999,x1=-999,y1=-999;polys.forEach(po=>po.forEach(r=>r.forEach(([x,y])=>{x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)})));
    return{idsubsls:p.idsubsls,nmsls:p.nmsls,kddesa:p.kddesa,nmdesa:p.nmdesa,berubah_batas:String(p.berubah_batas)==="1",geom:polys,bbox:[x0,y0,x1,y1],batch}});
  IMP.log("idsubsls unik ✓");IMP.set("Mengunggah batas SLS…",0);
  await upsertBatches("sls",rows,100,"SLS");
  const{data:old,error:oe}=await sb.from("sls").select("idsubsls").neq("batch",batch);if(oe)throw oe;
  if(old&&old.length){IMP.log(`SLS lama yang tidak ada di file baru: ${old.map(r=>r.idsubsls).join(", ")} — dihapus.`);const{error}=await sb.from("sls").delete().neq("batch",batch);if(error)throw error}
  IMP.set("Impor batas SLS selesai ✓",1);toast("Impor batas SLS selesai.");
}
function parseCSV(text){const lines=text.replace(/^﻿/,"").split(/\r?\n/).filter(l=>l.trim());if(!lines.length)return[];const sep=(lines[0].match(/;/g)||[]).length>(lines[0].match(/,/g)||[]).length?";":",";
  const split=l=>{const out=[];let cur="",q=false;for(let i=0;i<l.length;i++){const ch=l[i];if(q){if(ch==='"'&&l[i+1]==='"'){cur+='"';i++}else if(ch==='"')q=false;else cur+=ch}else if(ch==='"')q=true;else if(ch===sep){out.push(cur);cur=""}else cur+=ch}out.push(cur);return out.map(s=>s.trim())};
  const head=split(lines[0]);return lines.slice(1).map(l=>{const v=split(l),o={};head.forEach((h,i)=>o[h]=v[i]);return o})}
async function impTemuan(files){
  let rows=[];
  for(const f of files){const recs=parseCSV(await readText(f));if(!recs.length){IMP.log(f.name+": kosong");continue}const h=Object.keys(recs[0]);
    let jenis=h.includes("no_bang_di_peta")?"tanpa_titik":h.includes("jumlah_di_gambar")?"dobel":h.includes("unique_bang")?"tidak_di_peta":null;
    if(!jenis){IMP.log(f.name+": jenis tidak dikenali, dilewati");continue}
    recs.forEach(r=>{const no=r.no_bang_di_peta||r.no_bang;if(!r.idsubsls||!no)return;
      rows.push({idsubsls:r.idsubsls,jenis,no_bang:String(no).padStart(4,"0"),keterangan:null,_ket:(r.keterangan||"").trim(),_jml:+r.jumlah_di_gambar||2})});
    IMP.log(`${f.name}: ${recs.length} baris → ${TEM[jenis][0]}`)}
  const uniq={};rows.forEach(r=>uniq[r.idsubsls+"|"+r.jenis+"|"+r.no_bang]=r);rows=Object.values(uniq);
  const kend=rows.filter(r=>r.jenis!=="tanpa_titik").map(r=>({idsubsls:r.idsubsls,no_bang:r.no_bang,jenis:r.jenis,catatan:r._ket||"",jumlah:r.jenis==="dobel"?(r._jml||2):null}));
  rows=rows.filter(r=>r.jenis==="tanpa_titik").map(({_ket,_jml,...r})=>r);
  if(kend.length){IMP.set("Memasang kendala di titik…",0);let n=0;for(let i=0;i<kend.length;i+=500){const{data,error}=await sb.rpc("impor_kendala",{d:kend.slice(i,i+500)});if(error)throw error;n+=data}
    IMP.log(`Kendala titik (tidak ada di peta scan / dobel): ${kend.length} baris → ${n} titik baru diberi kendala (titik yang sudah diisi petugas tidak ditimpa)`)}
  if(rows.length){IMP.set("Mengunggah temuan…",0);await upsertBatches("temuan",rows,500,"Temuan","idsubsls,jenis,no_bang")}
  IMP.set(`Impor selesai ✓ (${rows.length} temuan, ${kend.length} kendala)`,1);toast("Impor temuan & kendala selesai.");
}
async function impAlokasi(files){
  const recs=parseCSV(await readText(files[0]));
  const k=(r,...names)=>{for(const n of names){const key=Object.keys(r).find(x=>x.toLowerCase().replace(/\s+/g," ").trim()===n);if(key&&r[key])return r[key].trim()}return""};
  const pml={},ppl={},sls=[];
  recs.forEach(r=>{const id=k(r,"id_subsls","idsubsls");if(!/^\d{16}$/.test(id))return;if(!id.startsWith(KODE()))return;
    const pe=k(r,"email pml").toLowerCase(),pn=k(r,"nama pml"),e=k(r,"email ppl").toLowerCase(),n=k(r,"nama ppl");if(!e||!pe)return;
    pml[pe]=pml[pe]||pn;ppl[e]=ppl[e]||{n,pe};sls.push({idsubsls:id,ppl_email:e})});
  IMP.log(`SLS Kec. ${NAMA_KEC()}: ${sls.length}, PML: ${Object.keys(pml).length}, PPL: ${Object.keys(ppl).length}`);
  if(!sls.length)throw new Error(`Tidak ada baris SLS Kecamatan ${NAMA_KEC()} (${KODE()}…) di file.`);
  const pr=Object.entries(pml).map(([e,n])=>({email:e,nama:S.people[e]?S.people[e].nama:n,peran:(S.people[e]&&S.people[e].peran==="ADMIN")?"PML":"PML",admin:!!(S.people[e]&&S.people[e].admin)}));
  await upsertBatches("petugas",pr,200,"PML");
  const pp=Object.entries(ppl).filter(([e])=>!pml[e]).map(([e,v])=>({email:e,nama:S.people[e]?S.people[e].nama:v.n,peran:"PPL",pml_email:v.pe,admin:!!(S.people[e]&&S.people[e].admin)}));
  await upsertBatches("petugas",pp,200,"PPL");
  await upsertBatches("sls",sls,300,"Alokasi SLS");
  IMP.set("Impor alokasi selesai ✓",1);toast("Alokasi petugas diperbarui.");
}
function parseJgw(t){const v=t.trim().split(/\s+/).map(Number);if(v.length<6||v.some(isNaN))throw new Error("isi JGW tidak valid");return v}
function corners(j,W,H){const[A,D,B,E,C,F]=j,g=(c,r)=>[A*c+B*r+C,D*c+E*r+F];return{tl:g(-.5,-.5),tr:g(W-.5,-.5),bl:g(-.5,H-.5)}}
async function toWebp(file,maxSide=2600,q=.55){
  const bmp=await createImageBitmap(file);const W=bmp.width,H=bmp.height,s=Math.min(1,maxSide/Math.max(W,H));
  const cv=document.createElement("canvas");cv.width=Math.round(W*s);cv.height=Math.round(H*s);
  cv.getContext("2d").drawImage(bmp,0,0,cv.width,cv.height);bmp.close&&bmp.close();
  const blob=await new Promise(r=>cv.toBlob(r,"image/webp",q));cv.width=cv.height=0;return{blob,W,H};
}
async function impScan(files){
  const by={};
  for(const f of files){const m=f.name.match(/^(\d{16})_WSS(_INSET)?\.(jpe?g|png|jgw|pgw)$/i);if(!m){continue}
    const key=m[1]+"_WSS"+(m[2]?"_INSET":"");(by[key]=by[key]||{key,id:m[1],jenis:m[2]?"inset":"wss"})[/^(jgw|pgw)$/i.test(m[3])?"jgw":"img"]=f}
  const items=Object.values(by);const skipped=files.length-items.reduce((a,i)=>a+(i.img?1:0)+(i.jgw?1:0),0);
  IMP.log(`Lembar dikenali: ${items.length}${skipped?` · ${skipped} file lain dilewati`:""}`);
  if(!items.length)throw new Error("Tidak ada file bernama {idsubsls}_WSS.jpg / _WSS_INSET.jpg / .jgw.");
  let done=0,fail=0;const t0=Date.now();
  const existing={};(await fetchAll(()=>sb.from("scan").select("key,w,h,path").order("key"))).forEach(r=>existing[r.key]=r);
  IMP.set("Mengunggah scan…",0);
  const work=async it=>{
    try{
      if(!it.jgw&&!existing[it.key])throw new Error("JGW tidak ikut dipilih");
      const jgw=it.jgw?parseJgw(await it.jgw.text()):null;
      if(it.img){
        const{blob,W,H}=await toWebp(it.img);
        const path=it.key+".webp";
        const{error}=await sb.storage.from("scan").upload(path,blob,{upsert:true,contentType:"image/webp",cacheControl:"3600"});if(error)throw error;
        const j=jgw||null;const c=j?corners(j,W,H):null;
        const row={key:it.key,idsubsls:it.id,jenis:it.jenis,path,w:W,h:H,updated_at:new Date().toISOString(),...(c||{})};
        if(!c){const{data}=await sb.from("scan").select("tl,tr,bl").eq("key",it.key).single();Object.assign(row,data)}
        const{error:e2}=await sb.from("scan").upsert(row);if(e2)throw e2;
      }else{
        const ex=existing[it.key];const c=corners(jgw,ex.w,ex.h);
        const{error}=await sb.from("scan").update({...c,updated_at:new Date().toISOString()}).eq("key",it.key);if(error)throw error;
      }
    }catch(e){fail++;IMP.log(`${it.key}: ${e.message||e}`)}
    done++;const el=(Date.now()-t0)/1000,eta=done?Math.round(el/done*(items.length-done)):0;
    IMP.set(`Mengunggah scan… ${done}/${items.length}${eta>5?` · sisa ±${eta>90?Math.round(eta/60)+" menit":eta+" detik"}`:""}`,done/items.length);
  };
  let idx=0;await Promise.all(Array.from({length:3},async()=>{while(idx<items.length){const it=items[idx++];await work(it)}}));
  IMP.set(`Unggah scan selesai ✓ (${items.length-fail} berhasil${fail?`, ${fail} gagal — lihat catatan`:""})`,1);
  toast(fail?`Scan selesai dengan ${fail} gagal.`:"Semua scan terunggah.",4000);
}
async function exportTemuan(){
  toast("Menyiapkan file temuan…");
  const rows=await fetchAll(()=>sb.from("temuan").select("*").order("idsubsls").order("jenis").order("no_bang"));
  const q=v=>{v=v==null?"":String(v);return /[",\n;]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
  const head=["idsubsls","desa","nmsls","jenis_temuan","no_bang","keterangan","jawaban","dijawab_oleh","dijawab_at"];
  const lines=[head.join(",")].concat(rows.map(r=>{const sl=S.sls[r.idsubsls]||{};return [r.idsubsls,sl.nmdesa,sl.nmsls,(TEM[r.jenis]||[r.jenis])[0],r.no_bang,r.keterangan,r.jawaban,r.dijawab_oleh?nameOf(r.dijawab_oleh):"",r.dijawab_at?tgl(r.dijawab_at):""].map(q).join(",")}));
  const blob=new Blob(["\ufeff"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download=`${KODE()}_temuan_admin_${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
  toast(`${rows.length} temuan diunduh (${rows.filter(r=>r.jawaban).length} sudah dijawab).`);
}
async function exportKoreksi(onlyOk){
  toast("Menyiapkan file…");
  const rows=await fetchAll(()=>sb.from("koreksi").select("*").neq("jenis","benar").order("assignment_id"));
  const sel=rows.filter(r=>!onlyOk||r.status==="disetujui");
  const need=sel.map(r=>r.assignment_id),orig={};
  for(let i=0;i<need.length;i+=200){const{data,error}=await sb.from("titik").select("assignment_id,lon,lat").in("assignment_id",need.slice(i,i+200));if(error){toast("Gagal: "+error.message);return}data.forEach(t=>orig[t.assignment_id]=t)}
  const fc={type:"FeatureCollection",name:KODE()+"_koreksi_petugas",crs:{type:"name",properties:{name:"urn:ogc:def:crs:OGC:1.3:CRS84"}},
    features:sel.map(r=>{const o=orig[r.assignment_id]||{};return{type:"Feature",properties:{assignment_id:r.assignment_id,unique_bang:r.unique_bang,no_bang:r.no_bang,idsubsls:r.idsubsls,jenis:r.jenis,catatan:r.catatan,oleh:r.oleh_email,waktu:r.updated_at,lon_baru:r.lon,lat_baru:r.lat,lon_asal:o.lon,lat_asal:o.lat},
      geometry:{type:"Point",coordinates:r.lon!=null?[r.lon,r.lat]:[o.lon,o.lat]}}})};
  const blob=new Blob([JSON.stringify(fc)],{type:"application/geo+json"});const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download=`${KODE()}_koreksi_petugas_${new Date().toISOString().slice(0,10)}${onlyOk?"_disetujui":""}.geojson`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
  toast(`${sel.length} perbaikan diunduh.`);
}

boot();
