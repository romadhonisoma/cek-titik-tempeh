/* Cek Titik Bangunan Tempeh — aplikasi online (Supabase + Leaflet) */
"use strict";
const sb = supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, { auth: { persistSession: true, detectSessionInUrl: true, flowType: "pkce" } });
const TARGET_TITIK = 36980, TARGET_SLS = 630;
/* naikkan bersama ?v= di index.html dan nama cache di sw.js setiap rilis */
const VERSI = "22", VERSI_TGL = "22 Okt 2026";
const MOBILE = () => innerWidth < 960;
const S = {
  me: null, view: "beranda", sel: null, scan: "wss", opac: .85, showPts: true, showBatas: true, base: "sat",
  tab: "titik", placing: null, focus: null, draft: null, detail: null, minHead: false, minSheet: MOBILE(),
  theme: "dark", open: {}, q: "",
  sls: {}, slsIds: [], people: {}, corr: {}, temuan: {}, status: {}, scans: {}, pts: {}, geoms: {}, urls: {}
};
const store = { get(k){try{return localStorage.getItem(k)}catch(e){return null}}, set(k,v){try{localStorage.setItem(k,v)}catch(e){}} };
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
function applyTheme(){document.documentElement.classList.toggle("light",S.theme==="light");document.querySelectorAll('meta[name="theme-color"]').forEach(m=>m.setAttribute("content",S.theme==="light"?"#d6d8e6":"#07060e"));
  document.querySelectorAll(".theme-toggle").forEach(b=>{b.innerHTML=S.theme==="light"?ICON.moon:ICON.sun;const l=S.theme==="light"?"Pakai tema gelap":"Pakai tema terang";b.setAttribute("aria-label",l);b.title=l});
  const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=S.theme==="light"?"#d6d8e6":"#07060e"}
document.addEventListener("click",e=>{if(e.target.closest(".theme-toggle")){S.theme=S.theme==="light"?"dark":"light";store.set("ctb-theme",S.theme);applyTheme();if(map)drawPts()}});
applyTheme();

/* ---------- Kaca 3D: kartu sedikit miring & berkilau mengikuti kursor (hanya perangkat bermouse) ---------- */
if(matchMedia("(hover:hover) and (pointer:fine)").matches&&!matchMedia("(prefers-reduced-motion:reduce)").matches){
  const TILT=".glass.card,.glass.kpi,.glass.corr,.login-card";let cur=null;
  const reset=el=>{["--rx","--ry","--sheen"].forEach(k=>el.style.removeProperty(k));el.classList.remove("tilt")};
  document.addEventListener("pointermove",e=>{const el=e.target.closest(TILT);if(cur&&cur!==el)reset(cur);cur=el;if(!el)return;
    const r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height,k=Math.min(1,260/Math.max(r.width,r.height));
    el.classList.add("tilt");el.style.setProperty("--rx",((.5-y)*6*k).toFixed(2)+"deg");el.style.setProperty("--ry",((x-.5)*7*k).toFixed(2)+"deg");
    el.style.setProperty("--mx",(x*100).toFixed(1)+"%");el.style.setProperty("--my",(y*100).toFixed(1)+"%");el.style.setProperty("--sheen","1")},{passive:true});
  document.documentElement.addEventListener("pointerleave",()=>{if(cur){reset(cur);cur=null}});
}

/* ---------- Pasang aplikasi (PWA) ---------- */
let deferredInstall=null;
addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e});
addEventListener("appinstalled",()=>{store.set("ctb-install-seen","1");toast("Aplikasi terpasang di perangkat ini.")});
if("serviceWorker" in navigator)addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
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
async function fetchAll(build,page=1000){let out=[],from=0;for(;;){const{data,error}=await build().range(from,from+page-1);if(error)throw error;out=out.concat(data);if(data.length<page)break;from+=page}return out}
const me=()=>S.me;
const isAdmin=()=>!!(S.me&&S.me.admin);
const isPML=()=>S.me&&(S.me.peran==="PML"||S.me.admin);
const nameOf=e=>(S.people[e]&&S.people[e].nama)||e||"—";
const AKSES={"":"—",lihat_desa:"Lihat seluruh desa",edit_desa:"Lihat & edit seluruh desa",lihat_kec:"Lihat seluruh kecamatan",lihat_kec_edit_desa:"Lihat sekecamatan, edit sedesa"};
function isBase(id){const s=S.sls[id];if(!s||!S.me)return false;return s.ppl_email===S.me.email||!!(S.people[s.ppl_email]&&S.people[s.ppl_email].pml_email===S.me.email)}
function myDesa(){if(S._md&&S._md.k===S.slsIds.length)return S._md.v;const v=new Set(S.slsIds.filter(isBase).map(id=>S.sls[id].kddesa));S._md={k:S.slsIds.length,v};return v}
function canEdit(id){if(!S.me)return false;if(isAdmin()||isBase(id))return true;const a=S.me.akses||"";return (a==="edit_desa"||a==="lihat_kec_edit_desa")&&!!S.sls[id]&&myDesa().has(S.sls[id].kddesa)}
function canReview(id){if(isAdmin())return true;const s=S.sls[id];return !!(s&&S.people[s.ppl_email]&&S.people[s.ppl_email].pml_email===S.me.email)}
function corrFromRow(r){return {aid:r.assignment_id,sls:r.idsubsls,no:r.no_bang,ub:r.unique_bang,jenis:r.jenis,lat:r.lat,lng:r.lon,note:r.catatan||"",by:r.oleh_email,at:r.updated_at||r.created_at,review:r.status,rby:r.reviewed_by}}
async function loadAll(){
  const [sls,ppl,kor,tem,st,sc,riw]=await Promise.all([
    fetchAll(()=>sb.from("sls").select("idsubsls,nmsls,kddesa,nmdesa,ppl_email,n_titik,n_far,berubah_batas,peta_sls").order("idsubsls")),
    fetchAll(()=>sb.from("petugas").select("email,nama,peran,pml_email,admin,akses").order("email")),
    fetchAll(()=>sb.from("koreksi").select("*").order("assignment_id")),
    fetchAll(()=>sb.from("temuan").select("id,idsubsls,jenis,no_bang,keterangan,jawaban,dijawab_oleh").order("id")),
    fetchAll(()=>sb.from("sls_status").select("*").order("idsubsls")),
    fetchAll(()=>sb.from("scan").select("key,idsubsls,jenis").order("key")),
    fetchAll(()=>sb.from("riwayat").select("*").order("assignment_id")).catch(()=>[])
  ]);
  S.sls={};sls.forEach(r=>S.sls[r.idsubsls]=r);S.slsIds=sls.map(r=>r.idsubsls);
  S.people={};ppl.forEach(r=>S.people[r.email]=r);
  S.corr={};kor.forEach(r=>S.corr[r.assignment_id]=corrFromRow(r));
  S.riw={};(riw||[]).forEach(r=>S.riw[r.assignment_id]=r);
  S.temuan={};tem.forEach(r=>(S.temuan[r.idsubsls]=S.temuan[r.idsubsls]||[]).push(r));
  S.status={};st.forEach(r=>S.status[r.idsubsls]=r);
  S.scans={};S.scanNote={};sc.forEach(r=>{(S.scans[r.idsubsls]=S.scans[r.idsubsls]||{})[r.jenis]=r.key});
}
function slsStat(s){
  const r=S.sls[s]||{},cor=Object.values(S.corr).filter(c=>c.sls===s);
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
    for(const r of rows){const{data}=await sb.storage.from("scan").createSignedUrl(r.path,6*3600);if(data)S.urls[id][r.jenis]={...r,url:data.signedUrl}}
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
    const {data,error}=await sb.from("petugas").select("*").eq("email",email).maybeSingle();
    if(error)throw error;
    if(!data){await sb.auth.signOut();S._logging=false;
      showLogin(`<b style="color:var(--bad)">Email ${esc(email)} belum terdaftar.</b><br>Minta admin (Soma Romadhoni) mendaftarkan atau mengganti email Anda, lalu coba masuk lagi.`);return}
    S.me=data;$("#boot").hidden=false;
    await loadAll();
    const sl=scope();S.sel=store.get("ctb-sel-"+email);if(!sl.includes(S.sel))S.sel=sl[0]||null;
    $("#boot").hidden=true;
    const lg=$("#login");if(!lg.hidden){const c=lg.firstElementChild;c.classList.add("a-out-zoom");lg.style.transition="opacity .3s";lg.style.opacity="0";await new Promise(r=>setTimeout(r,280));lg.hidden=true;lg.style.opacity="";c.classList.remove("a-out-zoom")}
    const app=$("#app");app.hidden=false;app.classList.remove("a-out-zoom");app.classList.add("a-zoom");render(0);
    if(!store.get("ctb-install-seen")&&!isStandalone())setTimeout(()=>showInstall(false),1200);
  }catch(e){console.error(e);$("#boot").hidden=true;showLogin(`<b style="color:var(--bad)">Gagal memuat data:</b> ${esc(e.message||e)}`)}
  S._logging=false;
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
    items.map(([k,l,ic])=>`<button type="button" data-v="${k}" class="${S.view===k?"on":""}">${ic}<span>${l}</span></button>`).join("")+
    `<button type="button" data-v="keluar">${ICON.out}<span>Keluar</span></button>`}
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
function go(v){if(v===S.view)return;const d=ORDER.indexOf(v)-ORDER.indexOf(S.view)||1;const cur=$("#view").firstElementChild;
  S.view=v;$("#nav").querySelectorAll("[data-v]").forEach(b=>b.classList.toggle("on",b.dataset.v===v));moveInd(true);
  if(cur){cur.style.transition="opacity .2s var(--ease-in),transform .2s var(--ease-in)";cur.style.opacity="0";cur.style.transform=`perspective(1400px) translate3d(${d>0?-28:28}px,0,-50px) rotateY(${d>0?5:-5}deg)`}
  setTimeout(()=>render(d),cur?190:0)}
$("#nav").addEventListener("click",e=>{const b=e.target.closest("button[data-v]");if(!b)return;if(b.dataset.v==="keluar")return confirmBox("Keluar dari aplikasi?","Anda perlu masuk lagi dengan akun Google untuk membuka aplikasi ini.","Keluar",true).then(ok=>ok&&logout());go(b.dataset.v)});
async function refreshAll(){try{await loadAll();S.pts={};S.urls={};toast("Data diperbarui.");render(0)}catch(e){toast("Gagal memuat ulang: "+e.message)}}

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
  const scopeTxt=isAdmin()?"Seluruh Kecamatan Tempeh":((S.me.peran==="PML"?"Semua SLS PPL Anda":"Semua SLS tugas Anda")+(S.me.akses?" + akses khusus: "+AKSES[S.me.akses].toLowerCase():""));
  const groups=groupsFor(sl);if(groups.length===1)S.open[groups[0].k]=true;
  const nBatas=sl.filter(id=>S.sls[id].berubah_batas).length;
  $("#view").innerHTML=`<div class="scroll"><div class="wrap stagger">
    <div class="hello" style="--i:0"><div><div class="eyebrow">${esc(u.admin&&u.peran!=="ADMIN"?u.peran+" · Admin":u.peran)}</div><h1>Halo, ${esc((u.nama||"").split(" ")[0])}</h1></div>
      <div class="top-actions"><button class="icon-btn" id="rfBtn" type="button" aria-label="Muat ulang data" title="Muat ulang data">${ICON.refresh}</button><button class="btn btn-sm" id="insBtn" type="button">${small(ICON.install)}Pasang</button><button class="icon-btn theme-toggle" type="button"></button></div></div>
    <div class="kpis" style="--i:1">
      <div class="glass kpi"><small>SLS</small><b class="mono">${fmt(sl.length)}</b><small>${tot.done} beres · <span style="color:var(--cyan)">${nBatas} berubah batas</span></small></div>
      <div class="glass kpi"><small>Titik bangunan</small><b class="mono">${fmt(tot.n)}</b><small><span style="color:var(--ok)">${fmt(tot.benar)} sudah benar</span> · <span style="color:var(--warn)">${fmt(tot.far)} perlu dicek</span></small></div>
      <div class="glass kpi"><small>Perbaikan lokasi</small><b class="mono">${fmt(tot.pindah)}</b><small><span style="color:var(--magenta)">${fmt(tot.salah)} titik ada kendala</span></small></div>
      <div class="glass kpi"><small>Temuan admin</small><b class="mono">${tot.dij}/${tot.tem}</b><small>sudah dijawab</small></div>
    </div>
    <div class="section-h" style="--i:2"><div><h2>Wilayah</h2><small class="muted">${scopeTxt} · per desa, dusun, lalu SLS</small></div>
      <label class="search" aria-label="Cari SLS">${ICON.search}<input class="field" id="q" placeholder="Cari SLS, dusun, atau nama petugas" value="${esc(S.q)}" autocomplete="off"></label></div>
    <div id="groups" style="--i:3;display:grid;gap:8px"></div>
    <div class="ver" style="--i:4">Cek Titik Bangunan Tempeh · <span class="mono">Versi ${VERSI}</span> · diperbarui ${VERSI_TGL}</div>
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
function rowsHtml(ids){return ids.map(id=>{const t=slsStat(id),s=S.sls[id];return `<button class="sls-row" data-s="${id}" type="button"><span class="k">${id.slice(10,14)}${id.slice(14)!=="00"?"."+id.slice(14):""}</span><span class="mid"><b>${esc(s.nmsls||id)}</b><span class="meta">${petugasTxt(id)}<span>${t.n} titik · <b style="color:var(--ok);display:inline;font-size:inherit">${t.benar} benar</b></span>${t.salah?`<span style="color:var(--magenta)">${t.salah} kendala</span>`:""}${t.far?`<span style="color:var(--warn)">${t.far} perlu dicek</span>`:""}${t.tem-t.dij?`<span style="color:var(--magenta)">${t.tem-t.dij} temuan</span>`:""}${s.berubah_batas?`<span style="color:var(--cyan);font-weight:700">● batas berubah</span>`:""}${s.peta_sls?`<span style="color:var(--warn);font-weight:700">⇄ peta ${s.peta_sls.slice(10,14)}</span>`:""}${canEdit(id)?"":`<span class="dim">👁 lihat saja</span>`}${S.scans[petaOf(id)]?"":`<span class="dim">scan belum ada</span>`}</span></span><span class="pill ${t.status[1]}">${t.status[0]}</span></button>`}).join("")}
function setSel(id){S.sel=id;store.set("ctb-sel-"+S.me.email,id)}

/* ---------- Peta ---------- */
let map=null,L_pts=null,L_bat=null,L_ctx=null,L_cor=null,scanLayer=null,baseLayer=null,ptMarkers={},popup=null,popFor=null;
function destroyMap(){if(map){map.remove();map=null;ptMarkers={};popup=null;popFor=null;scanLayer=null;baseLayer=null}}
const ImageTri=L.Layer.extend({
  initialize(url,tl,tr,bl,op){this.url=url;this.tl=L.latLng(tl[1],tl[0]);this.tr=L.latLng(tr[1],tr[0]);this.bl=L.latLng(bl[1],bl[0]);this.op=op},
  onAdd(m){this._m=m;const img=this._img=L.DomUtil.create("img","leaflet-image-layer leaflet-zoom-animated");
    img.style.transformOrigin="0 0";img.style.opacity=0;img.style.transition="opacity .5s";img.style.pointerEvents="none";img.alt="";
    img.onload=()=>{this._reset();requestAnimationFrame(()=>img.style.opacity=this.op)};img.onerror=()=>toast("Gambar scan gagal dimuat.");img.src=this.url;(m.getPane("scan")||m.getPanes().overlayPane).appendChild(img);
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
const BASES={sat:()=>L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxNativeZoom:19,maxZoom:22,attribution:"Citra © Esri, Maxar"})};

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
  map=L.map("map",{zoomControl:false,attributionControl:true,maxZoom:22,minZoom:11,zoomSnap:.25,wheelPxPerZoomLevel:90,inertiaDeceleration:2600,tapTolerance:20,center:[-8.2,113.17],zoom:13});
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
    return `<div class="pk-g">${esc(g.title)} · ${esc(d.title)}</div>`+ids.map(id=>{const x=S.sls[id],t=slsStat(id);return `<button type="button" class="pk-i ${id===S.sel?"on":""}" data-id="${id}" role="option"><span class="mono">${slsCode(id)}</span><span class="nm">${esc(shortNm(x.nmsls||""))}</span>${x.berubah_batas?`<i class="dotc" title="batas berubah"></i>`:""}${x.peta_sls?`<em>⇄</em>`:""}<span class="pill ${t.status[1]}">${t.status[0]}</span></button>`}).join("")}).join("")).join("")||`<div class="pk-g" style="text-transform:none">Tidak ada SLS yang cocok.</div>`}
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
  styleMarkers();
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
  if(d&&d.mode==="note")return `<div class="pop">${head}
      <span class="pill ${d.jenis==="tidak_di_peta"?"p-mag":"p-info"}" style="justify-self:start">${d.jenis==="tidak_di_peta"?"Tidak ada di gambar peta":"Catatan titik"}</span>
      <textarea id="popNote" placeholder="Tulis catatan, mis. nomor ${esc(+p.no||p.no)} di gambar ada di seberang jalan">${esc(d.note||"")}</textarea>
      <div class="acts"><button class="btn btn-grad" data-act="savenote" type="button">Simpan</button><button class="btn btn-ghost" data-act="cancel" type="button">Batal</button></div></div>`;
  const info=c&&c.jenis!=="benar"?`<div style="display:grid;gap:4px">
      ${c.jenis==="pindah"||c.jenis==="tidak_di_peta"?`<div class="row" style="gap:5px"><span class="pill ${c.jenis==="pindah"?"p-new":"p-mag"}">${JENIS[c.jenis]}</span></div>`:""}
      ${c.note?`<div style="font-size:11.5px">“${esc(c.note)}”</div>`:""}
      <div class="dim" style="font-size:10.5px">${corrMeta(c)}</div></div>`:(c&&c.jenis==="benar"?`<div class="dim" style="font-size:10.5px">Ditandai benar · ${corrMeta(c)}</div>`:"");
  const rw=S.riw&&S.riw[p.id],rwh=rw&&!(c&&c.jenis==="pindah")?`<div class="dim" style="font-size:10.5px">Riwayat terakhir: ${JENIS[rw.jenis]||"perbaikan"} oleh ${esc(nameOf(rw.oleh_email))} · ${esc(tgl(rw.waktu))} · sudah digabung ${esc(tgl(rw.digabung_at))}</div>`:"";
  return `<div class="pop">${head}
    ${p.far&&!(c&&c.jenis==="pindah")?`<div class="note"><b style="color:var(--warn)">Perlu dicek.</b> Titik bernomor ${esc(+p.no||p.no)} di SLS ini berjarak lebih dari 20 m.</div>`:""}
    ${info}${rwh}
    ${ed?`<div class="acts"><button class="btn btn-ghost" data-act="note" type="button">${c&&c.note?"✎ Catatan":"+ Catatan"}</button><button class="btn btn-grad" data-act="fix" type="button">${c&&c.jenis==="pindah"?"Ubah lokasi":"Perbaiki lokasi"}</button></div>
    <div class="row between">${c&&c.jenis==="pindah"?`<button class="link" data-act="reset" type="button">Kembalikan ke lokasi asal</button>`:`<button class="link" data-act="tdk" type="button">Tidak ada di peta</button>`}<button class="link" data-act="detail" type="button">Detail</button></div>`
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
async function removeCorr(p){
  const{error}=await sb.from("koreksi").delete().eq("assignment_id",p.id);
  if(error){toast("Gagal: "+error.message);refreshPop(p);return}
  delete S.corr[p.id];S.draft=null;drawPts();refreshPop(p,[p.y,p.x]);renderSheet();syncDone(p.sls).then(()=>renderSheet());toast("Perbaikan dihapus, titik kembali ke lokasi asal.");
}
async function save(p,d,opt={}){
  const row={assignment_id:p.id,idsubsls:p.sls,no_bang:p.no,unique_bang:p.ub,jenis:d.jenis,lon:d.jenis==="pindah"?d.lng:null,lat:d.jenis==="pindah"?d.lat:null,catatan:d.note||null,oleh_email:S.me.email,
    status:d.jenis==="benar"||d.jenis==="catatan"?"ok":"disetujui"};
  const {data,error}=await sb.from("koreksi").upsert(row,{onConflict:"assignment_id"}).select().single();
  if(error){toast("Gagal menyimpan: "+error.message);if(!opt.silent)refreshPop(p);return false}
  S.corr[p.id]=corrFromRow(data);S.draft=null;drawPts();renderSheet();syncDone(p.sls).then(()=>renderSheet());
  toast(d.jenis==="pindah"?`Lokasi baru tersimpan · ${nameOf(S.me.email)} · ${tgl(data.updated_at)}`:d.jenis==="tidak_di_peta"?"Tersimpan: tidak ada di peta.":"Catatan tersimpan.");
  if(!opt.silent)refreshPop(p,data.lat!=null?[data.lat,data.lon]:[p.y,p.x]);
  return true;
}
async function review(aid,status){
  const {data,error}=await sb.from("koreksi").update({status}).eq("assignment_id",aid).select().single();
  if(error){toast("Gagal: "+error.message);return false}
  S.corr[aid]=corrFromRow(data);toast(status==="disetujui"?"Perbaikan disetujui.":"Perbaikan ditolak.");return true;
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
  el.innerHTML=`<span class="no new">${esc(+p.no||p.no)}</span><div style="flex:1;min-width:0"><b>Geser peta sampai tanda ＋ tepat di bangunan</b><div class="muted" style="font-size:11px">${MOBILE()?"Perbesar peta agar pas":"Bisa juga klik langsung di peta"}, lalu tekan Simpan</div></div><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn btn-ghost btn-sm" id="cancelPlace" type="button">Batal</button><button class="btn btn-grad btn-sm" id="okPlace" type="button">Simpan</button></div>`;
  $("#cancelPlace").onclick=()=>{S.placing=null;renderBanner();drawPts()};
  $("#okPlace").onclick=async e=>{e.currentTarget.disabled=true;await placeAt(map.getCenter())};
}
function crossMode(){return true}
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
function rowStatus(p,c){if(!c)return p.far?"Belum dicek · nomor sama berjauhan":"Belum dicek";return JENIS[c.jenis]+(c.note&&c.jenis!=="catatan"?" · ada catatan":"")+" · "+esc(nameOf(c.by))}
function liHtml(p,ed){const c=S.corr[p.id],ok=isOk(c),kd=isKendala(c),open=S.kend&&S.kend.id===p.id;
  return `<div class="li li2 ${ok?"is-ok":""} ${kd?"is-kd":""}" data-p="${esc(p.id)}" role="button" tabindex="0" ${p.id===S.focus?'style="border-color:var(--line2)"':""}>
    <span class="no ${c&&c.jenis==="pindah"?"new":(p.far?"warn":"")}">${esc(+p.no||p.no)}</span>
    <span class="txt"><b>${esc(ptTitle(p,p.kk?"Bangunan tempat tinggal":"Bangunan"))}</b><small class="${ok?"st-ok":kd?"st-kd":""}">${rowStatus(p,c)}</small></span>
    ${ed?`<span class="li-acts"><button class="ic-ok ${ok?"on":""}" data-ok="${esc(p.id)}" type="button" aria-label="Sudah benar" title="Sudah benar">✓</button><button class="ic-kd ${kd||open?"on":""}" data-kd="${esc(p.id)}" type="button" aria-label="Ada kendala" title="Ada kendala">!</button></span>`:""}
  </div>${open?kendHtml(p,c):""}`}
function kendHtml(p,c){const k=S.kend;
  return `<div class="kend a-down" data-kp="${esc(p.id)}"><div class="kend-opts">${KEND.map(([v,l])=>`<button type="button" class="chip ${k.j===v?"on":""}" data-kj="${v}">${l}</button>`).join("")}</div>
    <textarea class="field" id="kendNote" placeholder="${k.j==="catatan"?"Jelaskan kendalanya":"Catatan (boleh dikosongkan)"}">${esc(k.note||"")}</textarea>
    <div class="row" style="justify-content:flex-end;gap:6px"><button class="btn btn-ghost btn-sm" data-kc type="button">Batal</button><button class="btn btn-grad btn-sm" data-ks type="button" ${k.j?"":"disabled"}>Simpan</button></div></div>`}
async function syncDone(s){
  const pts=S.pts[s];if(!pts||!pts.length||!canEdit(s))return;
  const all=pts.every(p=>isOk(S.corr[p.id])),cur=!!(S.status[s]&&S.status[s].selesai);
  if(all===cur)return;
  const{data,error}=await sb.from("sls_status").upsert({idsubsls:s,selesai:all,oleh:S.me.email,at:new Date().toISOString()}).select().single();
  if(!error){S.status[s]=data;if(all)toast("Semua titik sudah benar — SLS ini dinyatakan beres.",3200)}
}
async function markAllOk(s){
  const pts=S.pts[s]||[],todo=pts.filter(p=>!S.corr[p.id]),kd=pts.filter(p=>isKendala(S.corr[p.id])).length;
  if(!todo.length&&kd){toast(`Masih ada ${kd} titik dengan kendala. Ganti ke ✓ jika sudah benar.`,3800);return}
  const sisa=(S.temuan[s]||[]).filter(t=>!t.jawaban).length;
  const ok=await confirmBox("Nyatakan semua titik sudah benar?",`${todo.length} titik yang belum dicek akan ditandai <b>Sudah benar</b>.${kd?` ${kd} titik dengan kendala tetap seperti semula.`:""}${sisa?`<br>Masih ada ${sisa} temuan admin belum dijawab.`:""}`,"Ya, semua benar");
  if(!ok)return;
  const rows=todo.map(p=>({assignment_id:p.id,idsubsls:p.sls,no_bang:p.no,unique_bang:p.ub,jenis:"benar",lon:null,lat:null,catatan:null,oleh_email:S.me.email,status:"ok"}));
  for(let i=0;i<rows.length;i+=500){const{data,error}=await sb.from("koreksi").upsert(rows.slice(i,i+500),{onConflict:"assignment_id"}).select();if(error){toast("Gagal: "+error.message);return}data.forEach(r=>S.corr[r.assignment_id]=corrFromRow(r))}
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
      body=`<div class="empty">SLS ini tidak punya titik bangunan.</div>`;
    } else {
      if(anim==="back")bodyCls="a-inL";
      const list=[...pts].sort((a,b)=>(b.far-a.far)||String(a.no).localeCompare(String(b.no)));
      body=`<div class="tabs"><button type="button" class="chip ${S.tab==="titik"?"on":""}" data-t="titik">Titik (${pts.length})</button><button type="button" class="chip ${S.tab==="temuan"?"on":""}" data-t="temuan">Temuan admin (${t.tem-t.dij})</button></div>
      <div class="${anim==="tab"?(S.tab==="temuan"?"a-inR":"a-inL"):""}">${S.tab==="titik"?(list.length?`<div class="list">${list.map(p=>liHtml(p,ed)).join("")}</div>`:`<div class="empty">SLS ini tidak punya titik bangunan.</div>`):(tem.length?`<div class="list">${tem.map(x=>{const lab=TEM[x.jenis]||[x.jenis,"mag",""];
        return `<div class="li" style="display:grid;gap:6px"><div class="row" style="gap:9px;flex-wrap:nowrap"><span class="no ${lab[1]}">${esc(+x.no_bang||x.no_bang)}</span><span class="txt"><b>${lab[0]}</b><small>${esc(x.keterangan||lab[2])}</small></span></div>
         ${x.jawaban?`<div class="row between"><small class="muted">Jawaban: ${esc(x.jawaban)} — ${esc(nameOf(x.dijawab_oleh))}</small><button class="link" data-reans="${x.id}" type="button" style="font-size:11px;color:var(--muted);text-decoration:underline">ubah</button></div>`:`<div class="row" style="gap:6px;flex-wrap:nowrap"><input class="field ans" data-i="${x.id}" placeholder="Jawaban singkat" style="flex:1;min-width:0"><button class="btn btn-grad btn-sm" data-ans="${x.id}" type="button">Kirim</button></div>`}</div>`}).join("")}</div>`:`<div class="empty">Tidak ada temuan admin untuk SLS ini.</div>`)}</div>
      ${ed?`<button class="btn ${t.done?"btn-done":"btn-grad"}" id="doneBtn" type="button" style="width:100%">${t.done?"✓ SLS ini sudah saya cek, semua benar":"Nyatakan SLS ini sudah beres (semua benar)"}</button>`:(t.done?`<div class="pill p-ok" style="justify-self:center">✓ SLS ini sudah dicek, semua benar</div>`:"")}`;
    }
  }
  sh.innerHTML=bar+`<div class="sheet-body ${bodyCls}">${body}</div>`;
  const fabs=$("#fabs");if(fabs)requestAnimationFrame(()=>fabs.style.setProperty("--fab-b",(MOBILE()?(S.minSheet?sh.querySelector(".sheet-bar").offsetHeight:Math.min(sh.scrollHeight,innerHeight*.58))+22:20)+"px"));
  $("#sheetBar").onclick=()=>toggleSheet(!S.minSheet);
  if(S.minSheet)return;
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
    if(t.done){toast("SLS ini sudah beres. Jika ada kendala, tekan ! pada nomor bangunannya.",3500);return}
    await markAllOk(s);
  };
  sh.querySelectorAll("[data-ok]").forEach(b=>b.onclick=async ev=>{ev.stopPropagation();const p=ptById(b.dataset.ok),c=S.corr[p.id];
    if(isOk(c)){if(c.jenis==="pindah")toast("Lokasi titik ini sudah diperbaiki (dihitung benar).");return}
    b.disabled=true;S.kend=null;await save(p,{jenis:"benar",note:c?c.note:""},{silent:true});await syncDone(s);renderSheet()});
  sh.querySelectorAll("[data-kd]").forEach(b=>b.onclick=ev=>{ev.stopPropagation();const p=ptById(b.dataset.kd),c=S.corr[p.id];
    S.kend=S.kend&&S.kend.id===p.id?null:{id:p.id,j:isKendala(c)?c.jenis:"",note:c?c.note:""};renderSheet()});
  sh.querySelectorAll("[data-kj]").forEach(b=>b.onclick=ev=>{ev.stopPropagation();S.kend.j=b.dataset.kj;S.kend.note=$("#kendNote").value;renderSheet();const t=$("#kendNote");t&&t.focus()});
  const kc=sh.querySelector("[data-kc]");if(kc)kc.onclick=ev=>{ev.stopPropagation();S.kend=null;renderSheet()};
  const ks=sh.querySelector("[data-ks]");if(ks)ks.onclick=async ev=>{ev.stopPropagation();const k=S.kend,p=ptById(k.id),note=$("#kendNote").value.trim();
    if(k.j==="catatan"&&!note){toast("Tulis penjelasan kendalanya.");return}
    ks.disabled=true;const okk=await save(p,{jenis:k.j,note},{silent:true});if(okk){S.kend=null;await syncDone(s);renderSheet()}else ks.disabled=false};
  sh.querySelectorAll(".kend").forEach(el=>el.onclick=ev=>ev.stopPropagation());
}

/* ---------- Koreksi ---------- */
function vKoreksi(){
  const list=Object.values(S.corr).filter(c=>c.jenis!=="benar").sort((a,b)=>(a.review==="menunggu"?0:1)-(b.review==="menunggu"?0:1)||String(b.at).localeCompare(String(a.at)));
  const f=S.kf||"semua";const shown=list.filter(c=>f==="semua"||c.jenis===f);
  $("#view").innerHTML=`<div class="scroll"><div class="wrap stagger">
    <div class="hello" style="--i:0"><div><div class="eyebrow">Riwayat perbaikan</div><h1>Perbaikan lokasi</h1></div>
      <div class="row" style="gap:6px">${[["semua","Semua"],["pindah","Lokasi diperbaiki"],["tidak_di_peta","Tidak ada di peta"],["catatan","Catatan"]].map(([k,l])=>`<button class="chip ${f===k?"on":""}" data-f="${k}" type="button">${l} (${k==="semua"?list.length:list.filter(c=>c.jenis===k).length})</button>`).join("")}</div></div>
    ${shown.length?shown.slice(0,300).map((c,i)=>`<article class="glass corr" style="--i:${Math.min(i+1,12)}">
      <div class="corr-head"><div class="row" style="gap:10px;flex-wrap:nowrap"><span class="no new" style="font-size:14px;padding:5px 9px">${esc(+c.no||c.no)}</span><div style="min-width:0"><b>${JENIS[c.jenis]}</b><div class="muted" style="font-size:11px">${esc((S.sls[c.sls]||{}).nmsls||c.sls)} · <span class="mono">${esc(c.ub)}</span></div></div></div><span class="pill ${REV[c.review][1]}">${REV[c.review][0]}</span></div>
      ${c.note?`<div>“${esc(c.note)}”</div>`:""}
      ${c.lat!=null?`<div class="muted mono" style="font-size:11px">lokasi baru → ${(+c.lat).toFixed(6)}, ${(+c.lng).toFixed(6)}</div>`:""}
      <div class="row between"><small class="dim">oleh ${esc(nameOf(c.by))} · ${esc(tgl(c.at))}</small>
        <div class="row" style="gap:6px"><button class="btn btn-ghost btn-sm" data-go="${esc(c.aid)}" data-s="${c.sls}" type="button">Lihat di peta</button>
        </div></div>
    </article>`).join("")+(shown.length>300?`<div class="dim" style="text-align:center">Menampilkan 300 dari ${shown.length}. Gunakan filter.</div>`:""):`<div class="glass empty" style="--i:1">${list.length?"Tidak ada perbaikan dengan status ini.":"Belum ada perbaikan. Buka Peta, ketuk nomor bangunan yang lokasinya salah, lalu pilih \"Perbaiki lokasi\"."}</div>`}
  </div></div>`;
  $("#view").querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>{S.kf=b.dataset.f;vKoreksi()});
  $("#view").querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{setSel(b.dataset.s);S.focus=b.dataset.go;S.draft=null;S.detail=null;S._view=null;go("peta")});
  $("#view").querySelectorAll("[data-ok]").forEach(b=>b.onclick=async()=>{b.disabled=true;if(await review(b.dataset.ok,"disetujui"))vKoreksi()});
  $("#view").querySelectorAll("[data-no]").forEach(b=>b.onclick=async()=>{b.disabled=true;if(await review(b.dataset.no,"ditolak"))vKoreksi()});
}

/* ---------- Admin ---------- */
function vAdmin(){
  if(!isAdmin()){go("beranda");return}
  const pml=Object.values(S.people).filter(v=>v.peran==="PML").sort((a,b)=>a.nama.localeCompare(b.nama));
  const adm=Object.values(S.people).filter(v=>v.admin);
  const rows=pml.flatMap(pv=>[pv,...Object.values(S.people).filter(v=>v.peran==="PPL"&&v.pml_email===pv.email).sort((a,b)=>a.nama.localeCompare(b.nama))]);
  const nSlsOf=e=>S.slsIds.filter(id=>S.sls[id].ppl_email===e||(S.people[S.sls[id].ppl_email]||{}).pml_email===e).length;
  const totT=S.slsIds.reduce((a,id)=>a+(S.sls[id].n_titik||0),0),nScan=Object.values(S.scans).reduce((a,v)=>a+Object.keys(v).length,0);
  $("#view").innerHTML=`<div class="scroll"><div class="wrap stagger">
    <div class="hello" style="--i:0"><div><div class="eyebrow">Admin</div><h1>Pengelolaan data</h1></div></div>
    <section style="display:grid;gap:10px;--i:1">
      <div class="section-h"><h2>Impor data dari QGIS</h2><small class="muted">Data di server: ${fmt(totT)} titik · ${S.slsIds.length} SLS · ${nScan} lembar scan</small></div>
      <div class="imp">
        <div class="glass card"><div class="row between"><b>Titik bangunan</b><span class="pill p-blue">GeoJSON</span></div>
          <small class="muted">File <span class="mono">3508_geotagging_koreksi.geojson</span>. Harus tepat <b>${fmt(TARGET_TITIK)}</b> titik dan assignment_id unik. Perbaikan petugas tetap menempel.</small>
          <label class="btn btn-ghost btn-sm filebtn">Pilih file titik…<input type="file" accept=".geojson,.json" multiple data-imp="titik"></label></div>
        <div class="glass card"><div class="row between"><b>Batas SLS</b><span class="pill p-blue">GeoJSON</span></div>
          <small class="muted">File <span class="mono">3508050_sls_2026-1.geojson</span>. Harus tepat <b>${TARGET_SLS}</b> SLS. Alokasi PPL tidak berubah.</small>
          <label class="btn btn-ghost btn-sm filebtn">Pilih file SLS…<input type="file" accept=".geojson,.json" data-imp="sls"></label></div>
        <div class="glass card"><div class="row between"><b>Scan peta + JGW</b><span class="pill p-blue">JPG + JGW</span></div>
          <small class="muted">Pilih semua file di <span class="mono">01_Rename Scan Peta</span> (boleh sebagian). Gambar diperkecil otomatis sebelum diunggah. Jika hanya memilih .jgw, posisi scan saja yang diperbarui.</small>
          <label class="btn btn-ghost btn-sm filebtn">Pilih file scan…<input type="file" accept=".jpg,.jpeg,.png,.jgw,.pgw" multiple data-imp="scan"></label></div>
        <div class="glass card"><div class="row between"><b>Temuan admin</b><span class="pill p-blue">CSV</span></div>
          <small class="muted">3 file catatan: <span class="mono">nomor_di_peta_tanpa_titik</span>, <span class="mono">titik_tidak_ada_di_peta</span>, <span class="mono">nomor_dobel_di_peta</span>. Jawaban petugas tidak hilang.</small>
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
      <div class="section-h"><h2>Admin & koordinator</h2></div>
      <div class="glass card">${adm.map(a=>`<div class="row between"><span><b>${esc(a.nama)}</b> <span class="dim mono">${esc(a.email)}</span></span>${a.email!==S.me.email?`<button class="btn btn-bad btn-sm" data-unadm="${esc(a.email)}" type="button">Cabut admin</button>`:`<span class="pill p-info">Anda</span>`}</div>`).join("")}
        <div class="row" style="flex-wrap:nowrap"><input class="field" id="admEmail" placeholder="email koordinator" style="flex:1"><input class="field" id="admName" placeholder="nama" style="flex:1"><button class="btn btn-grad btn-sm" id="addAdm" type="button">Tambah admin</button></div></div>
    </section>
    <section style="display:grid;gap:10px;--i:3">
      <div class="section-h"><h2>Petugas</h2><small class="muted">${pml.length} PML · ${Object.values(S.people).filter(v=>v.peran==="PPL").length} PPL · ubah nama atau email lalu tekan Simpan · akses khusus langsung tersimpan saat dipilih</small></div>
      <div class="tbl-wrap glass" style="max-height:420px"><table><thead><tr><th>Wilayah</th><th>Nama</th><th>Peran</th><th>Email login</th><th></th><th>Akses khusus</th></tr></thead><tbody>
        ${rows.map(r=>`<tr${r.peran==="PML"?' style="background:var(--soft)"':""}><td class="mono">${nSlsOf(r.email)} SLS</td><td><input class="field nm" data-f="nama" value="${esc(r.nama)}" data-old="${esc(r.nama)}" aria-label="Nama ${esc(r.nama)}"${r.peran==="PML"?' style="font-weight:700"':""}></td><td>${r.peran}${r.admin?" · admin":""}</td><td><input class="field" data-f="email" value="${esc(r.email)}" data-old="${esc(r.email)}" aria-label="Email ${esc(r.nama)}"></td><td><button class="btn btn-ghost btn-sm" data-saveem="${esc(r.email)}" type="button">Simpan</button></td><td><select class="field" data-akses="${esc(r.email)}" aria-label="Akses khusus ${esc(r.nama)}" style="min-width:190px">${Object.entries(AKSES).map(([k,l])=>`<option value="${k}" ${(r.akses||"")===k?"selected":""}>${l}</option>`).join("")}</select></td></tr>`).join("")}
      </tbody></table></div>
    </section>
  </div></div>`;
  $("#view").querySelectorAll("input[data-imp]").forEach(inp=>inp.onchange=()=>{const files=[...inp.files];inp.value="";if(files.length)runImport(inp.dataset.imp,files)});
  $("#dlAll").onclick=()=>exportKoreksi(false);$("#dlTem").onclick=exportTemuan;
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
  $("#addAdm").onclick=async()=>{const e=$("#admEmail").value.trim().toLowerCase(),n=$("#admName").value.trim()||e;
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)){toast("Isi email yang valid.");return}
    const ex=S.people[e];const{error}=ex?await sb.from("petugas").update({admin:true}).eq("email",e):await sb.from("petugas").insert({email:e,nama:n,peran:"ADMIN",admin:true});
    if(error){toast("Gagal: "+error.message);return}toast("Admin ditambahkan.");await loadAll();vAdmin()};
  $("#view").querySelectorAll("[data-unadm]").forEach(b=>b.onclick=async()=>{const e=b.dataset.unadm;const p=S.people[e];
    const{error}=p.peran==="ADMIN"?await sb.from("petugas").delete().eq("email",e):await sb.from("petugas").update({admin:false}).eq("email",e);
    if(error){toast("Gagal: "+error.message);return}toast("Hak admin dicabut.");await loadAll();vAdmin()});
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
  IMP.log(`Jumlah titik: ${fmt(feats.length)} (target ${fmt(TARGET_TITIK)})`);
  if(feats.length!==TARGET_TITIK)throw new Error(`Jumlah titik ${fmt(feats.length)}, bukan ${fmt(TARGET_TITIK)}. Impor dibatalkan, data lama tetap dipakai.`);
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
  const keepNote=doneFix.filter(r=>r.catatan).map(r=>r.assignment_id),drop=doneFix.filter(r=>!r.catatan).map(r=>r.assignment_id);
  for(let i=0;i<keepNote.length;i+=200){const{error}=await sb.from("koreksi").update({jenis:"catatan",lon:null,lat:null}).in("assignment_id",keepNote.slice(i,i+200));if(error)throw error}
  for(let i=0;i<drop.length;i+=200){const{error}=await sb.from("koreksi").delete().in("assignment_id",drop.slice(i,i+200));if(error)throw error}
  IMP.log(`Perbaikan lokasi yang sudah masuk file baru: ${fmt(doneFix.length)} (garis kuning dihapus; ${fmt(keepNote.length)} catatannya tetap disimpan)`);
  const nk=await fetchAll(()=>sb.from("koreksi").select("*").order("assignment_id"));S.corr={};nk.forEach(r=>S.corr[r.assignment_id]=corrFromRow(r));S.pts={};
  const lost=Object.keys(S.corr).filter(a=>!ids.has(a));
  IMP.log(lost.length?`Perhatian: ${lost.length} perbaikan merujuk titik yang sudah tidak ada.`:"Semua perbaikan petugas masih menempel ✓");
  IMP.set("Impor titik selesai ✓",1);toast("Impor titik selesai.");
}
function dp(P,eps){if(P.length<3)return P;const a=P[0],b=P[P.length-1];let dmax=0,idx=0;for(let i=1;i<P.length-1;i++){const p=P[i],dx=b[0]-a[0],dy=b[1]-a[1],n=Math.hypot(dx,dy)||1e-12,d=Math.abs(dy*p[0]-dx*p[1]+b[0]*a[1]-b[1]*a[0])/n;if(d>dmax){dmax=d;idx=i}}return dmax>eps?dp(P.slice(0,idx+1),eps).slice(0,-1).concat(dp(P.slice(idx),eps)):[a,b]}
function simpRing(r,eps){if(r.length<5)return r;let far=0,md=0;r.forEach((p,i)=>{const d=(p[0]-r[0][0])**2+(p[1]-r[0][1])**2;if(d>md){md=d;far=i}});return dp(r.slice(0,far+1),eps).slice(0,-1).concat(dp(r.slice(far),eps)).map(p=>[+p[0].toFixed(7),+p[1].toFixed(7)])}
async function impSls(files){
  const feats=await readGeo(files);
  IMP.log(`Jumlah SLS: ${feats.length} (target ${TARGET_SLS})`);
  if(feats.length!==TARGET_SLS)throw new Error(`Jumlah SLS ${feats.length}, bukan ${TARGET_SLS}. Impor dibatalkan.`);
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
      rows.push({idsubsls:r.idsubsls,jenis,no_bang:no,keterangan:jenis==="dobel"?`Ditulis ${r.jumlah_di_gambar||"2"} kali di gambar.${r.keterangan?" "+r.keterangan:""}`:null})});
    IMP.log(`${f.name}: ${recs.length} baris → ${TEM[jenis][0]}`)}
  const uniq={};rows.forEach(r=>uniq[r.idsubsls+"|"+r.jenis+"|"+r.no_bang]=r);rows=Object.values(uniq);
  IMP.set("Mengunggah temuan…",0);await upsertBatches("temuan",rows,500,"Temuan","idsubsls,jenis,no_bang");
  IMP.set(`Impor temuan selesai ✓ (${rows.length} temuan)`,1);toast("Impor temuan selesai.");
}
async function impAlokasi(files){
  const recs=parseCSV(await readText(files[0]));
  const k=(r,...names)=>{for(const n of names){const key=Object.keys(r).find(x=>x.toLowerCase().replace(/\s+/g," ").trim()===n);if(key&&r[key])return r[key].trim()}return""};
  const pml={},ppl={},sls=[];
  recs.forEach(r=>{const id=k(r,"id_subsls","idsubsls");if(!/^\d{16}$/.test(id))return;if(!id.startsWith("3508050"))return;
    const pe=k(r,"email pml").toLowerCase(),pn=k(r,"nama pml"),e=k(r,"email ppl").toLowerCase(),n=k(r,"nama ppl");if(!e||!pe)return;
    pml[pe]=pml[pe]||pn;ppl[e]=ppl[e]||{n,pe};sls.push({idsubsls:id,ppl_email:e})});
  IMP.log(`SLS Kec. Tempeh: ${sls.length}, PML: ${Object.keys(pml).length}, PPL: ${Object.keys(ppl).length}`);
  if(!sls.length)throw new Error("Tidak ada baris SLS Kecamatan Tempeh (3508050…) di file.");
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
  a.href=URL.createObjectURL(blob);a.download=`3508050_temuan_admin_${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
  toast(`${rows.length} temuan diunduh (${rows.filter(r=>r.jawaban).length} sudah dijawab).`);
}
async function exportKoreksi(onlyOk){
  toast("Menyiapkan file…");
  const rows=await fetchAll(()=>sb.from("koreksi").select("*").neq("jenis","benar").order("assignment_id"));
  const sel=rows.filter(r=>!onlyOk||r.status==="disetujui");
  const need=sel.map(r=>r.assignment_id),orig={};
  for(let i=0;i<need.length;i+=200){const{data,error}=await sb.from("titik").select("assignment_id,lon,lat").in("assignment_id",need.slice(i,i+200));if(error){toast("Gagal: "+error.message);return}data.forEach(t=>orig[t.assignment_id]=t)}
  const fc={type:"FeatureCollection",name:"3508050_koreksi_petugas",crs:{type:"name",properties:{name:"urn:ogc:def:crs:OGC:1.3:CRS84"}},
    features:sel.map(r=>{const o=orig[r.assignment_id]||{};return{type:"Feature",properties:{assignment_id:r.assignment_id,unique_bang:r.unique_bang,no_bang:r.no_bang,idsubsls:r.idsubsls,jenis:r.jenis,catatan:r.catatan,oleh:r.oleh_email,waktu:r.updated_at,lon_baru:r.lon,lat_baru:r.lat,lon_asal:o.lon,lat_asal:o.lat},
      geometry:{type:"Point",coordinates:r.lon!=null?[r.lon,r.lat]:[o.lon,o.lat]}}})};
  const blob=new Blob([JSON.stringify(fc)],{type:"application/geo+json"});const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download=`3508050_koreksi_petugas_${new Date().toISOString().slice(0,10)}${onlyOk?"_disetujui":""}.geojson`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
  toast(`${sel.length} perbaikan diunduh.`);
}

boot();
