-- Parque industrial: catálogo completo de piezas y reciclaje de chatarra.
--
-- La columna study_sessions.piece ya era texto libre, así que el catálogo nuevo (36 piezas)
-- entra sin cambios. Las sesiones viejas con "tornillo" se pasan al cajón de bulones.

update public.study_sessions set piece = 'bulones' where piece = 'tornillo';

-- Cada fila = 5 chatarras recicladas en una pieza común
create table if not exists public.recycles (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  piece      text not null check (char_length(piece) between 1 and 40),
  created_at timestamptz not null default now()
);
create index if not exists recycles_user on public.recycles (user_id);

alter table public.recycles enable row level security;

drop policy if exists "grupo lee" on public.recycles;
create policy "grupo lee" on public.recycles for select to authenticated using (true);
drop policy if exists "carga lo suyo" on public.recycles;
create policy "carga lo suyo" on public.recycles for insert to authenticated with check (user_id = auth.uid());

-- Solo se puede reciclar si hay chatarra suficiente: 5 por cada reciclaje
create or replace function public.check_recycle() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  scrap int;
  used int;
begin
  select count(*) into scrap from study_sessions where user_id = new.user_id and outcome = 'abandoned';
  select count(*) into used from recycles where user_id = new.user_id;
  if scrap - used * 5 < 5 then
    raise exception 'No hay chatarra suficiente para reciclar';
  end if;
  return new;
end $$;

drop trigger if exists check_recycle on public.recycles;
create trigger check_recycle before insert on public.recycles
  for each row execute function public.check_recycle();

do $$
begin
  alter publication supabase_realtime add table public.recycles;
exception when duplicate_object then null;
end $$;
