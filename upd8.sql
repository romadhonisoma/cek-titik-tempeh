-- v27: admin dikunci untuk email pemilik; akses baru edit_kec (koordinator / pembantu perbaikan)
alter table public.petugas drop constraint if exists petugas_akses_check;
alter table public.petugas add constraint petugas_akses_check check (akses is null or akses = any(array['lihat_desa','edit_desa','lihat_kec','lihat_kec_edit_desa','edit_kec']));
alter table public.petugas drop constraint if exists petugas_peran_check;
alter table public.petugas add constraint petugas_peran_check check (peran = any(array['PPL','PML','ADMIN','KOORDINATOR']));

-- koordinator: bukan admin lagi, tetap lihat & edit seluruh kecamatan
update public.petugas set admin=false, akses='edit_kec', peran=case when peran='ADMIN' then 'KOORDINATOR' else peran end
 where admin and nama not ilike 'soma romadhoni%';

-- is_admin hanya untuk email pemilik yang tertulis di fungsi (diambil dari admin yang tersisa)
do $$ declare lst text; begin
  select string_agg(quote_literal(email), ',') into lst from public.petugas where admin;
  execute 'create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $b$ select public.me() in (' || lst || ') and exists(select 1 from petugas where email = public.me() and admin) $b$';
end $$;

create or replace function public.can_edit(s text) returns boolean language sql stable security definer set search_path=public as $$
  select public.is_admin() or public.is_base(s) or coalesce(public.my_akses(),'') = 'edit_kec'
    or (coalesce(public.my_akses(),'') in ('edit_desa','lihat_kec_edit_desa') and (select kddesa from sls where idsubsls = s) = any(public.my_desa())) $$;
create or replace function public.my_see() returns text[] language sql stable security definer set search_path=public as $$
  with m as (select public.me() e, coalesce((select akses from petugas where email = public.me()),'') a, public.is_admin() adm),
  base as (select x.idsubsls, x.kddesa from sls x left join petugas p on p.email = x.ppl_email, m where x.ppl_email = m.e or p.pml_email = m.e)
  select coalesce(array_agg(x.idsubsls),'{}') from sls x, m
  where m.adm or x.idsubsls in (select idsubsls from base)
     or m.a in ('lihat_kec','lihat_kec_edit_desa','edit_kec')
     or (m.a in ('lihat_desa','edit_desa') and x.kddesa in (select kddesa from base)) $$;
create or replace function public.my_edit() returns text[] language sql stable security definer set search_path=public as $$
  with m as (select public.me() e, coalesce((select akses from petugas where email = public.me()),'') a, public.is_admin() adm),
  base as (select x.idsubsls, x.kddesa from sls x left join petugas p on p.email = x.ppl_email, m where x.ppl_email = m.e or p.pml_email = m.e)
  select coalesce(array_agg(x.idsubsls),'{}') from sls x, m
  where m.adm or m.a = 'edit_kec' or x.idsubsls in (select idsubsls from base)
     or (m.a in ('edit_desa','lihat_kec_edit_desa') and x.kddesa in (select kddesa from base)) $$;

select string_agg(nama||' ['||peran||'] admin:'||admin||' akses:'||coalesce(akses,'-'), ' ; ') hasil from petugas where admin or akses is not null;
