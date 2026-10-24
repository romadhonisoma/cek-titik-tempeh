-- v25: percepat aturan hak akses (daftar SLS dihitung sekali per permintaan, bukan per baris)
create or replace function public.my_see() returns text[] language sql stable security definer set search_path=public as $$
  with m as (select public.me() e, coalesce((select akses from petugas where email = public.me()),'') a, public.is_admin() adm),
  base as (select x.idsubsls, x.kddesa from sls x left join petugas p on p.email = x.ppl_email, m where x.ppl_email = m.e or p.pml_email = m.e)
  select coalesce(array_agg(x.idsubsls),'{}') from sls x, m
  where m.adm or x.idsubsls in (select idsubsls from base)
     or m.a in ('lihat_kec','lihat_kec_edit_desa')
     or (m.a in ('lihat_desa','edit_desa') and x.kddesa in (select kddesa from base)) $$;
create or replace function public.my_edit() returns text[] language sql stable security definer set search_path=public as $$
  with m as (select public.me() e, coalesce((select akses from petugas where email = public.me()),'') a, public.is_admin() adm),
  base as (select x.idsubsls, x.kddesa from sls x left join petugas p on p.email = x.ppl_email, m where x.ppl_email = m.e or p.pml_email = m.e)
  select coalesce(array_agg(x.idsubsls),'{}') from sls x, m
  where m.adm or x.idsubsls in (select idsubsls from base)
     or (m.a in ('edit_desa','lihat_kec_edit_desa') and x.kddesa in (select kddesa from base)) $$;
create or replace function public.my_see_scan() returns text[] language sql stable security definer set search_path=public as $$
  select coalesce(array_agg(distinct v),'{}') from (
    select unnest(public.my_see()) v
    union select x.peta_sls from sls x where x.peta_sls is not null and x.idsubsls = any(public.my_see())) q $$;
grant execute on function public.my_see(), public.my_edit(), public.my_see_scan() to authenticated;

-- tabel berbasis SLS
drop policy if exists sel on public.sls;   create policy sel on public.sls   for select to authenticated using ((select public.is_admin()) or idsubsls = any(coalesce((select public.my_see()),'{}'::text[])));
drop policy if exists sel on public.titik; create policy sel on public.titik for select to authenticated using ((select public.is_admin()) or idsubsls = any(coalesce((select public.my_see()),'{}'::text[])));
drop policy if exists sel on public.scan;  create policy sel on public.scan  for select to authenticated using ((select public.is_admin()) or idsubsls = any(coalesce((select public.my_see_scan()),'{}'::text[])));
drop policy if exists adm on public.sls;   create policy adm on public.sls   for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists adm on public.titik; create policy adm on public.titik for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists adm on public.scan;  create policy adm on public.scan  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists k_sel on public.koreksi; create policy k_sel on public.koreksi for select to authenticated using ((select public.is_admin()) or idsubsls = any(coalesce((select public.my_see()),'{}'::text[])));
drop policy if exists k_ins on public.koreksi; create policy k_ins on public.koreksi for insert to authenticated with check (idsubsls = any(coalesce((select public.my_edit()),'{}'::text[])) and oleh_email = (select public.me()));
drop policy if exists k_upd on public.koreksi; create policy k_upd on public.koreksi for update to authenticated using (idsubsls = any(coalesce((select public.my_edit()),'{}'::text[]))) with check (idsubsls = any(coalesce((select public.my_edit()),'{}'::text[])));
drop policy if exists k_del on public.koreksi; create policy k_del on public.koreksi for delete to authenticated using (idsubsls = any(coalesce((select public.my_edit()),'{}'::text[])));

drop policy if exists t_sel on public.temuan; create policy t_sel on public.temuan for select to authenticated using ((select public.is_admin()) or idsubsls = any(coalesce((select public.my_see()),'{}'::text[])));
drop policy if exists t_upd on public.temuan; create policy t_upd on public.temuan for update to authenticated using (idsubsls = any(coalesce((select public.my_edit()),'{}'::text[]))) with check (idsubsls = any(coalesce((select public.my_edit()),'{}'::text[])));
drop policy if exists t_ins on public.temuan; create policy t_ins on public.temuan for insert to authenticated with check (jenis = 'tanpa_titik' and idsubsls = any(coalesce((select public.my_edit()),'{}'::text[])));
drop policy if exists t_adm on public.temuan; create policy t_adm on public.temuan for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists s_sel on public.sls_status; create policy s_sel on public.sls_status for select to authenticated using ((select public.is_admin()) or idsubsls = any(coalesce((select public.my_see()),'{}'::text[])));
drop policy if exists s_ins on public.sls_status; create policy s_ins on public.sls_status for insert to authenticated with check (idsubsls = any(coalesce((select public.my_edit()),'{}'::text[])));
drop policy if exists s_upd on public.sls_status; create policy s_upd on public.sls_status for update to authenticated using (idsubsls = any(coalesce((select public.my_edit()),'{}'::text[]))) with check (idsubsls = any(coalesce((select public.my_edit()),'{}'::text[])));

drop policy if exists r_sel on public.riwayat; create policy r_sel on public.riwayat for select to authenticated using ((select public.is_admin()) or idsubsls = any(coalesce((select public.my_see()),'{}'::text[])));

drop policy if exists p_sel on public.petugas; create policy p_sel on public.petugas for select to authenticated using ((select public.is_registered()));
drop policy if exists p_adm on public.petugas; create policy p_adm on public.petugas for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- indeks bantu
create index if not exists koreksi_sls on public.koreksi(idsubsls);
create index if not exists temuan_sls on public.temuan(idsubsls);
create index if not exists petugas_pml on public.petugas(pml_email);
create index if not exists riwayat_sls on public.riwayat(idsubsls);
analyze public.sls; analyze public.titik; analyze public.koreksi; analyze public.petugas;
select 'ok' as hasil;
