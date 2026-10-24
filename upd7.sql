-- v25: status memori (admin), daftar scan tak terpakai, kembalikan centang titik yang sudah digabung
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
revoke all on function public.status_memori(), public.scan_yatim() from public, anon;
grant execute on function public.status_memori(), public.scan_yatim() to authenticated;

insert into koreksi(assignment_id,idsubsls,no_bang,unique_bang,jenis,catatan,oleh_email,status)
select r.assignment_id,t.idsubsls,t.no_bang,t.unique_bang,'benar',r.catatan,r.oleh_email,'ok'
from riwayat r join titik t using(assignment_id)
where not exists(select 1 from koreksi k where k.assignment_id=r.assignment_id);
select count(*) as dikembalikan from koreksi k join riwayat r using(assignment_id) where k.jenis='benar';
