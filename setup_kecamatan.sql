-- =====================================================================
--  Cek Titik Bangunan SE2026 — PEMASANGAN DATABASE KECAMATAN BARU
--  Jalankan SEKALI di SQL Editor project Supabase kecamatan yang baru.
--  >>> Ubah hanya bagian "ISIAN" di bawah, lalu tekan Run. <<<
-- =====================================================================

create table if not exists public.pengaturan(
  id int primary key default 1 check (id = 1),
  kode_kec text not null check (kode_kec ~ '^\d{7}$'),
  nama_kec text not null,
  nama_kab text not null default 'Lumajang',
  target_titik int not null default 0,
  target_sls int not null default 0,
  admin_emails text[] not null,
  hub_url text, hub_key text,
  updated_at timestamptz default now());

-- ============================ ISIAN ==================================
create temp table _isi as select
  '3508XXX'::text                    as kode_kec,     -- kode kecamatan 7 digit, mis. 3508050
  'NAMA KECAMATAN'::text             as nama_kec,     -- mis. Tempeh
  0                                  as target_titik, -- jumlah titik bangunan (boleh diisi nanti di menu Admin)
  0                                  as target_sls,   -- jumlah SLS (boleh diisi nanti di menu Admin)
  array['admin.kecamatan@gmail.com'] as admin_emails, -- email Google admin kecamatan (boleh lebih dari satu)
  array['Nama Admin Kecamatan']      as admin_nama;   -- nama admin, urutannya sama dengan email di atas
-- =====================================================================

do $$ declare r record; begin
  select * into r from _isi;
  if r.kode_kec !~ '^\d{7}$' or r.kode_kec = '3508XXX' then raise exception 'ISIAN: kode kecamatan harus 7 angka, mis. 3508050'; end if;
  if r.nama_kec = 'NAMA KECAMATAN' or trim(r.nama_kec) = '' then raise exception 'ISIAN: isi nama kecamatan'; end if;
  if 'admin.kecamatan@gmail.com' = any(r.admin_emails) then raise exception 'ISIAN: isi email Google admin kecamatan'; end if;
  if cardinality(r.admin_emails) <> cardinality(r.admin_nama) then raise exception 'ISIAN: jumlah email admin dan nama admin harus sama'; end if;
end $$;

insert into public.pengaturan(id, kode_kec, nama_kec, target_titik, target_sls, admin_emails, hub_url, hub_key)
select 1, kode_kec, trim(nama_kec), target_titik, target_sls, (select array_agg(lower(trim(x))) from unnest(admin_emails) x),
  'https://swjljwbsgvbwxsoxjjng.supabase.co', 'sb_publishable_gddG52qUGR3y6l8BkkZwSg_Qxmii8WQ'   -- pusat (Tempeh)
from _isi on conflict (id) do nothing;

create extension if not exists http with schema extensions;

-- ============================ TABEL ==================================
create table public.petugas(
  email text primary key check (email = lower(email)),
  nama text not null,
  peran text not null check (peran in ('PPL','PML','ADMIN','KOORDINATOR','KAB')),
  pml_email text references public.petugas(email) on update cascade on delete set null,
  admin boolean not null default false,
  akses text check (akses is null or akses in ('lihat_desa','edit_desa','lihat_kec','lihat_kec_edit_desa','edit_kec','lihat_kab')),
  created_at timestamptz default now());
create index petugas_pml on public.petugas(pml_email);

create table public.sls(
  idsubsls text primary key, nmsls text, kddesa text, nmdesa text,
  ppl_email text references public.petugas(email) on update cascade on delete set null,
  geom jsonb, bbox float8[], n_titik int default 0, n_far int default 0, batch text,
  updated_at timestamptz default now(), berubah_batas boolean default false,
  peta_sls text references public.sls(idsubsls) on delete set null);
create index sls_kddesa on public.sls(kddesa);
create index sls_ppl on public.sls(ppl_email);
create index sls_peta on public.sls(peta_sls) where peta_sls is not null;

create table public.titik(
  assignment_id text primary key, idsubsls text not null, no_bang text, unique_bang text,
  kode_bang text, kk smallint, usaha smallint, nama_usaha text, lon float8, lat float8,
  far boolean default false, info jsonb, batch text, keluarga jsonb);
create index titik_sls on public.titik(idsubsls);

create table public.scan(
  key text primary key, idsubsls text not null, jenis text, path text,
  tl float8[], tr float8[], bl float8[], w int, h int, updated_at timestamptz default now(), catatan text);
create index scan_sls on public.scan(idsubsls);

create table public.koreksi(
  assignment_id text primary key, idsubsls text not null, no_bang text, unique_bang text,
  jenis text not null check (jenis in ('benar','pindah','tidak_di_peta','dobel','catatan')),
  lon float8, lat float8, catatan text, oleh_email text,
  status text not null default 'menunggu' check (status in ('menunggu','disetujui','ditolak','ok')),
  reviewed_by text, reviewed_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now(), jumlah int);
create index koreksi_sls on public.koreksi(idsubsls);

create table public.temuan(
  id bigserial primary key, idsubsls text not null, jenis text not null, no_bang text not null,
  keterangan text, jawaban text, dijawab_oleh text, dijawab_at timestamptz,
  unique (idsubsls, jenis, no_bang));
create index temuan_sls on public.temuan(idsubsls);
create table public.temuan_arsip(
  id bigint, idsubsls text, jenis text, no_bang text, keterangan text, jawaban text, dijawab_oleh text, dijawab_at timestamptz);

create table public.sls_status(
  idsubsls text primary key, selesai boolean default false, oleh text, at timestamptz default now());

create table public.riwayat(
  assignment_id text primary key, idsubsls text not null, jenis text, lon float8, lat float8,
  catatan text, oleh_email text, waktu timestamptz, digabung_at timestamptz default now());
create index riwayat_sls on public.riwayat(idsubsls);

insert into public.petugas(email, nama, peran, admin) select lower(trim(e)), n, 'ADMIN', true from _isi, unnest(admin_emails, admin_nama) as u(e, n) on conflict do nothing;

-- ============================ FUNGSI =================================
create or replace function public.me() returns text language sql stable as
$$ select lower(coalesce(auth.jwt()->>'email','')) $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as
$$ select public.me() = any(coalesce((select admin_emails from pengaturan where id = 1),'{}'))
          and exists(select 1 from petugas where email = public.me() and admin) $$;
create or replace function public.is_registered() returns boolean language sql stable security definer set search_path=public as
$$ select exists(select 1 from petugas where email = public.me()) $$;
create or replace function public.my_akses() returns text language sql stable security definer set search_path=public as
$$ select akses from petugas where email = public.me() $$;
create or replace function public.my_pml() returns text language sql stable security definer set search_path=public as
$$ select pml_email from petugas where email = public.me() $$;
create or replace function public.is_base(s text) returns boolean language sql stable security definer set search_path=public as
$$ select exists(select 1 from sls x left join petugas p on p.email = x.ppl_email
     where x.idsubsls = s and (x.ppl_email = public.me() or p.pml_email = public.me())) $$;
create or replace function public.my_desa() returns text[] language sql stable security definer set search_path=public as
$$ select coalesce(array_agg(distinct x.kddesa),'{}') from sls x left join petugas p on p.email = x.ppl_email
     where x.ppl_email = public.me() or p.pml_email = public.me() $$;
create or replace function public.is_pml_of(s text) returns boolean language sql stable security definer set search_path=public as
$$ select public.is_admin() or exists(select 1 from sls x join petugas p on p.email = x.ppl_email
     where x.idsubsls = s and p.pml_email = public.me()) $$;
create or replace function public.can_edit(s text) returns boolean language sql stable security definer set search_path=public as
$$ select public.is_admin() or public.is_base(s) or coalesce(public.my_akses(),'') = 'edit_kec'
     or (coalesce(public.my_akses(),'') in ('edit_desa','lihat_kec_edit_desa') and (select kddesa from sls where idsubsls = s) = any(public.my_desa())) $$;
create or replace function public.can_see(s text) returns boolean language sql stable security definer set search_path=public as
$$ select public.can_edit(s)
     or coalesce(public.my_akses(),'') in ('lihat_kec','lihat_kec_edit_desa','lihat_kab')
     or (coalesce(public.my_akses(),'') in ('lihat_desa','edit_desa') and (select kddesa from sls where idsubsls = s) = any(public.my_desa())) $$;
create or replace function public.can_see_peta(s text) returns boolean language sql stable security definer set search_path=public as
$$ select public.can_see(s) or exists(select 1 from sls x where x.peta_sls = s and public.can_see(x.idsubsls)) $$;
create or replace function public.my_see() returns text[] language sql stable security definer set search_path=public as $$
  with m as (select public.me() e, coalesce((select akses from petugas where email = public.me()),'') a, public.is_admin() adm),
  base as (select x.idsubsls, x.kddesa from sls x left join petugas p on p.email = x.ppl_email, m where x.ppl_email = m.e or p.pml_email = m.e)
  select coalesce(array_agg(x.idsubsls),'{}') from sls x, m
  where m.adm or x.idsubsls in (select idsubsls from base)
     or m.a in ('lihat_kec','lihat_kec_edit_desa','edit_kec','lihat_kab')
     or (m.a in ('lihat_desa','edit_desa') and x.kddesa in (select kddesa from base)) $$;
create or replace function public.my_edit() returns text[] language sql stable security definer set search_path=public as $$
  with m as (select public.me() e, coalesce((select akses from petugas where email = public.me()),'') a, public.is_admin() adm),
  base as (select x.idsubsls, x.kddesa from sls x left join petugas p on p.email = x.ppl_email, m where x.ppl_email = m.e or p.pml_email = m.e)
  select coalesce(array_agg(x.idsubsls),'{}') from sls x, m
  where m.adm or m.a = 'edit_kec' or x.idsubsls in (select idsubsls from base)
     or (m.a in ('edit_desa','lihat_kec_edit_desa') and x.kddesa in (select kddesa from base)) $$;
create or replace function public.my_see_scan() returns text[] language sql stable security definer set search_path=public as $$
  select coalesce(array_agg(distinct v),'{}') from (
    select unnest(public.my_see()) v
    union select x.peta_sls from sls x where x.peta_sls is not null and x.idsubsls = any(public.my_see())) q $$;

create or replace function public.koreksi_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.updated_at := now();
  new.status := case when new.jenis in ('benar','catatan') then 'ok' else 'disetujui' end;
  new.reviewed_by := null; new.reviewed_at := null;
  return new;
end $$;
create trigger koreksi_guard before insert or update on public.koreksi for each row execute function public.koreksi_guard();

create or replace function public.impor_kendala(d jsonb) returns integer language plpgsql security definer set search_path=public as $$
declare n int; begin
  if not public.is_admin() then raise exception 'Hanya admin'; end if;
  insert into koreksi(assignment_id,idsubsls,no_bang,unique_bang,jenis,catatan,jumlah,oleh_email)
  select distinct on (ti.assignment_id) ti.assignment_id, ti.idsubsls, ti.no_bang, ti.unique_bang, x->>'jenis', nullif(x->>'catatan',''), nullif(x->>'jumlah','')::int, public.me()
  from jsonb_array_elements(d) x join titik ti on ti.idsubsls = x->>'idsubsls' and ti.no_bang = x->>'no_bang'
  on conflict (assignment_id) do nothing;
  get diagnostics n = row_count; return n; end $$;
create or replace function public.set_keluarga(d jsonb) returns integer language plpgsql security definer set search_path=public as $$
declare n int; begin
  if not public.is_admin() then raise exception 'Hanya admin'; end if;
  update titik t set keluarga = x.value->'k' from jsonb_array_elements(d) x where t.assignment_id = x.value->>'id';
  get diagnostics n = row_count; return n; end $$;
create or replace function public.status_memori() returns json language plpgsql stable security definer set search_path=public as $$
declare r json; begin
  if not public.is_admin() then raise exception 'khusus admin'; end if;
  select json_build_object(
    'db', pg_database_size(current_database()),
    'scan_n', (select count(*) from storage.objects where bucket_id='scan'),
    'scan', (select coalesce(sum((metadata->>'size')::bigint),0) from storage.objects where bucket_id='scan'),
    'lain', (select coalesce(sum((metadata->>'size')::bigint),0) from storage.objects where bucket_id<>'scan'),
    'yatim_n', (select count(*) from storage.objects o where bucket_id='scan' and not exists(select 1 from scan s where s.path=o.name and exists(select 1 from sls x where x.idsubsls=s.idsubsls))),
    'yatim', (select coalesce(sum((metadata->>'size')::bigint),0) from storage.objects o where bucket_id='scan' and not exists(select 1 from scan s where s.path=o.name and exists(select 1 from sls x where x.idsubsls=s.idsubsls))),
    'tabel', (select json_agg(json_build_object('t',relname,'b',pg_total_relation_size(c.oid)) order by pg_total_relation_size(c.oid) desc) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r')
  ) into r; return r; end $$;
create or replace function public.scan_yatim() returns text[] language plpgsql security definer set search_path=public as $$
declare a text[]; begin
  if not public.is_admin() then raise exception 'khusus admin'; end if;
  delete from scan s where not exists(select 1 from sls x where x.idsubsls=s.idsubsls);
  select coalesce(array_agg(o.name),'{}') into a from storage.objects o where bucket_id='scan' and not exists(select 1 from scan s where s.path=o.name);
  return a; end $$;

-- rekap angka untuk halaman Kabupaten (tanpa nama/email/lokasi; boleh dibaca tanpa login)
create or replace function public.rekap_publik() returns json language sql stable security definer set search_path=public as $$
  with k as (select k.idsubsls, k.jenis from koreksi k),
  d as (select x.kddesa, max(x.nmdesa) nmdesa, count(*) n_sls, sum(x.n_titik) n_titik,
          count(*) filter (where st.selesai) beres
        from sls x left join sls_status st on st.idsubsls = x.idsubsls group by x.kddesa),
  kd as (select x.kddesa, count(*) filter (where k.jenis in ('benar','pindah')) ok, count(*) filter (where k.jenis = 'pindah') pindah,
          count(*) filter (where k.jenis in ('tidak_di_peta','dobel','catatan')) kendala
        from k join sls x on x.idsubsls = k.idsubsls group by x.kddesa)
  select json_build_object(
    'kode', p.kode_kec, 'nama', p.nama_kec, 'target_titik', p.target_titik, 'target_sls', p.target_sls,
    'n_sls', (select count(*) from sls), 'n_titik', (select count(*) from titik),
    'beres', (select count(*) from sls_status where selesai),
    'ok', (select count(*) from k where jenis in ('benar','pindah')),
    'pindah', (select count(*) from k where jenis = 'pindah'),
    'kendala', (select count(*) from k where jenis in ('tidak_di_peta','dobel','catatan')),
    'temuan', (select count(*) from temuan), 'temuan_dijawab', (select count(*) from temuan where jawaban is not null),
    'n_petugas', (select count(*) from petugas where peran in ('PPL','PML')),
    'terakhir', (select max(updated_at) from koreksi),
    'desa', (select coalesce(json_agg(json_build_object('kd',d.kddesa,'nm',d.nmdesa,'n_sls',d.n_sls,'beres',d.beres,'n_titik',coalesce(d.n_titik,0),
              'ok',coalesce(kd.ok,0),'pindah',coalesce(kd.pindah,0),'kendala',coalesce(kd.kendala,0)) order by d.kddesa),'[]')
             from d left join kd on kd.kddesa = d.kddesa))
  from pengaturan p where p.id = 1 $$;

-- koordinator kabupaten: dicek ke database pusat, lalu didaftarkan sebagai "lihat saja"
create or replace function public.cek_kab() returns boolean language plpgsql security definer set search_path=public, extensions as $$
declare e text := public.me(); u text; k text; ok boolean := false; r record; begin
  if e = '' then return false; end if;
  select hub_url, hub_key into u, k from pengaturan where id = 1;
  if u is null then return false; end if;
  begin
    select * into r from extensions.http(('POST', u || '/rest/v1/rpc/is_koord_kab',
      array[extensions.http_header('apikey', k)], 'application/json', json_build_object('e', e)::text)::extensions.http_request);
    ok := r.status = 200 and trim(r.content) = 'true';
  exception when others then
    return exists(select 1 from petugas where email = e and akses = 'lihat_kab');
  end;
  if ok then
    insert into petugas(email, nama, peran, akses) values (e, coalesce(nullif(auth.jwt()->'user_metadata'->>'full_name',''), e), 'KAB', 'lihat_kab')
    on conflict (email) do update set akses = case when petugas.peran in ('KAB') then 'lihat_kab' else petugas.akses end;
  else
    delete from petugas where email = e and peran = 'KAB';
  end if;
  return ok; end $$;

-- ========================= ATURAN AKSES (RLS) ========================
alter table public.pengaturan enable row level security;
alter table public.petugas enable row level security;
alter table public.sls enable row level security;
alter table public.titik enable row level security;
alter table public.scan enable row level security;
alter table public.koreksi enable row level security;
alter table public.temuan enable row level security;
alter table public.temuan_arsip enable row level security;
alter table public.sls_status enable row level security;
alter table public.riwayat enable row level security;

create policy g_sel on public.pengaturan for select to authenticated using ((select public.is_registered()));
create policy g_upd on public.pengaturan for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy p_sel on public.petugas for select to authenticated using ((select public.is_registered()));
create policy p_adm on public.petugas for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy sel on public.sls   for select to authenticated using ((select public.is_admin()) or idsubsls = any(coalesce((select public.my_see()),'{}'::text[])));
create policy adm on public.sls   for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy sel on public.titik for select to authenticated using ((select public.is_admin()) or idsubsls = any(coalesce((select public.my_see()),'{}'::text[])));
create policy adm on public.titik for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy sel on public.scan  for select to authenticated using ((select public.is_admin()) or idsubsls = any(coalesce((select public.my_see_scan()),'{}'::text[])));
create policy adm on public.scan  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy k_sel on public.koreksi for select to authenticated using ((select public.is_admin()) or idsubsls = any(coalesce((select public.my_see()),'{}'::text[])));
create policy k_ins on public.koreksi for insert to authenticated with check (idsubsls = any(coalesce((select public.my_edit()),'{}'::text[])) and oleh_email = (select public.me()));
create policy k_upd on public.koreksi for update to authenticated using (idsubsls = any(coalesce((select public.my_edit()),'{}'::text[]))) with check (idsubsls = any(coalesce((select public.my_edit()),'{}'::text[])));
create policy k_del on public.koreksi for delete to authenticated using (idsubsls = any(coalesce((select public.my_edit()),'{}'::text[])));

create policy t_sel on public.temuan for select to authenticated using ((select public.is_admin()) or idsubsls = any(coalesce((select public.my_see()),'{}'::text[])));
create policy t_ins on public.temuan for insert to authenticated with check (jenis = 'tanpa_titik' and idsubsls = any(coalesce((select public.my_edit()),'{}'::text[])));
create policy t_upd on public.temuan for update to authenticated using (idsubsls = any(coalesce((select public.my_edit()),'{}'::text[]))) with check (idsubsls = any(coalesce((select public.my_edit()),'{}'::text[])));
create policy t_adm on public.temuan for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy ta_adm on public.temuan_arsip for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy s_sel on public.sls_status for select to authenticated using ((select public.is_admin()) or idsubsls = any(coalesce((select public.my_see()),'{}'::text[])));
create policy s_ins on public.sls_status for insert to authenticated with check (idsubsls = any(coalesce((select public.my_edit()),'{}'::text[])));
create policy s_upd on public.sls_status for update to authenticated using (idsubsls = any(coalesce((select public.my_edit()),'{}'::text[]))) with check (idsubsls = any(coalesce((select public.my_edit()),'{}'::text[])));

create policy r_sel on public.riwayat for select to authenticated using ((select public.is_admin()) or idsubsls = any(coalesce((select public.my_see()),'{}'::text[])));
create policy r_adm on public.riwayat for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ========================= PENYIMPANAN SCAN ==========================
insert into storage.buckets (id, name, public) values ('scan','scan',false) on conflict (id) do nothing;
drop policy if exists scan_read on storage.objects;
create policy scan_read on storage.objects for select to authenticated using (bucket_id = 'scan' and public.can_see_peta(left(name,16)));
drop policy if exists scan_write on storage.objects;
create policy scan_write on storage.objects for insert to authenticated with check (bucket_id = 'scan' and public.is_admin());
drop policy if exists scan_upd on storage.objects;
create policy scan_upd on storage.objects for update to authenticated using (bucket_id = 'scan' and public.is_admin());
drop policy if exists scan_del on storage.objects;
create policy scan_del on storage.objects for delete to authenticated using (bucket_id = 'scan' and public.is_admin());

-- ========================= HAK DATA API ==============================
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke update, insert, delete on public.pengaturan from authenticated;
grant update (nama_kec, nama_kab, kode_kec, target_titik, target_sls, updated_at) on public.pengaturan to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;
grant execute on function public.rekap_publik() to anon;

select 'Database Kecamatan ' || nama_kec || ' (' || kode_kec || ') siap. Admin: ' || array_to_string(admin_emails, ', ') as hasil from public.pengaturan;
