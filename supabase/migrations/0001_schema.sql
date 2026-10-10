-- Remontada: esquema de base de datos para Supabase.
-- Correr entero en el SQL Editor del proyecto (o con `supabase db push`).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Configuración privada (código de invitación, URL de funciones, secreto)
-- Nadie la puede leer desde la app; solo las funciones con privilegios.
-- ---------------------------------------------------------------------------
create table if not exists public.app_config (
  key   text primary key,
  value text not null
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

insert into public.app_config (key, value) values
  ('invite_code',   'CAMBIAME'),                                        -- código que piden al registrarse
  ('functions_url', 'https://TU-PROYECTO.supabase.co/functions/v1'),    -- URL base de las Edge Functions
  ('notify_secret', 'CAMBIAME-POR-UN-SECRETO-LARGO')                   -- mismo valor que el secret NOTIFY_SECRET
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Perfiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 30),
  avatar        jsonb not null default '{"style":"bottts","seed":"remontada","bg":"FFC21A"}',
  plan_id       text,
  notify_feed   boolean not null default true,
  notify_wakeup boolean not null default true,
  notify_exams  boolean not null default true,
  notify_weekly boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Estado de materias (si no hay fila, la materia está pendiente)
create table if not exists public.subject_status (
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  plan_id    text not null,
  subject_id text not null,
  subject_name text,
  status     text not null check (status in ('cursando', 'regularizada', 'aprobada')),
  updated_at timestamptz not null default now(),
  primary key (user_id, plan_id, subject_id)
);

-- Sesiones de estudio (el id lo genera el celular para poder guardar sin conexión)
create table if not exists public.study_sessions (
  id           uuid primary key,
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  subject_id   text,
  subject_name text not null check (char_length(subject_name) between 1 and 80),
  started_at   timestamptz not null,
  minutes      integer not null check (minutes between 1 and 720),
  source       text not null check (source in ('timer', 'manual')),
  outcome      text not null check (outcome in ('completed', 'abandoned')),
  piece        text not null,
  created_at   timestamptz not null default now()
);
create index if not exists study_sessions_user_started on public.study_sessions (user_id, started_at);

-- Actividad física
create table if not exists public.activities (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind       text not null check (char_length(kind) between 1 and 40),
  done_on    date not null,
  minutes    integer check (minutes is null or minutes between 1 and 600),
  created_at timestamptz not null default now()
);
create index if not exists activities_user_done on public.activities (user_id, done_on);

-- Exámenes (compartidos: varias personas pueden sumarse al mismo)
create table if not exists public.exams (
  id           uuid primary key,
  created_by   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  subject_name text not null check (char_length(subject_name) between 1 and 80),
  kind         text not null check (kind in ('parcial', 'recuperatorio', 'final', 'coloquio', 'otro')),
  starts_at    timestamptz not null,
  location     text,
  notes        text,
  created_at   timestamptz not null default now()
);

create table if not exists public.exam_participants (
  exam_id   uuid not null references public.exams (id) on delete cascade,
  user_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (exam_id, user_id)
);

-- Suscripciones a notificaciones push (una por dispositivo)
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Seguridad por filas: el grupo ve todo; cada uno modifica solo lo suyo
-- ---------------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.subject_status     enable row level security;
alter table public.study_sessions     enable row level security;
alter table public.activities         enable row level security;
alter table public.exams              enable row level security;
alter table public.exam_participants  enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "grupo lee perfiles" on public.profiles;
create policy "grupo lee perfiles" on public.profiles for select to authenticated using (true);
drop policy if exists "edita su perfil" on public.profiles;
create policy "edita su perfil" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['subject_status', 'study_sessions', 'activities', 'exam_participants'] loop
    execute format('drop policy if exists "grupo lee" on public.%I', t);
    execute format('create policy "grupo lee" on public.%I for select to authenticated using (true)', t);
    execute format('drop policy if exists "carga lo suyo" on public.%I', t);
    execute format('create policy "carga lo suyo" on public.%I for insert to authenticated with check (user_id = auth.uid())', t);
    execute format('drop policy if exists "edita lo suyo" on public.%I', t);
    execute format('create policy "edita lo suyo" on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('drop policy if exists "borra lo suyo" on public.%I', t);
    execute format('create policy "borra lo suyo" on public.%I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

drop policy if exists "grupo lee" on public.exams;
create policy "grupo lee" on public.exams for select to authenticated using (true);
drop policy if exists "crea examen" on public.exams;
create policy "crea examen" on public.exams for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "edita su examen" on public.exams;
create policy "edita su examen" on public.exams for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
drop policy if exists "borra su examen" on public.exams;
create policy "borra su examen" on public.exams for delete to authenticated using (created_by = auth.uid());

drop policy if exists "sus dispositivos" on public.push_subscriptions;
create policy "sus dispositivos" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Registro: exige el código de invitación y crea el perfil
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  expected text;
begin
  select value into expected from public.app_config where key = 'invite_code';
  if expected is null or coalesce(new.raw_user_meta_data ->> 'invite_code', '') <> expected then
    raise exception 'Código de invitación incorrecto';
  end if;
  insert into public.profiles (id, display_name, avatar)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)), 30),
    jsonb_build_object('style', 'bottts', 'seed', new.id::text, 'bg', 'FFC21A')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Avisos push en el momento: cada carga nueva llama a la función "notify"
-- (requiere la extensión pg_net, que Supabase trae activada)
-- ---------------------------------------------------------------------------
create or replace function public.notify_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base   text;
  secret text;
  rec    jsonb := to_jsonb(new);
begin
  -- Aprobar o regularizar una materia avisa; pasarla a "cursando" o marcar el CBC no.
  -- (Se lee el registro como JSON porque cada tabla tiene columnas distintas.)
  if tg_table_name = 'subject_status' then
    if rec ->> 'status' = 'cursando' or rec ->> 'subject_id' like 'CBC%' then
      return new;
    end if;
    if tg_op = 'UPDATE' and to_jsonb(old) ->> 'status' = rec ->> 'status' then
      return new;
    end if;
  end if;
  select value into base   from public.app_config where key = 'functions_url';
  select value into secret from public.app_config where key = 'notify_secret';
  if base is null or base like '%TU-PROYECTO%' then
    return new;
  end if;
  perform net.http_post(
    url     := base || '/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', secret),
    body    := jsonb_build_object('table', tg_table_name, 'record', rec)
  );
  return new;
end;
$$;

drop trigger if exists notify_session on public.study_sessions;
create trigger notify_session after insert on public.study_sessions
  for each row execute function public.notify_group();
drop trigger if exists notify_activity on public.activities;
create trigger notify_activity after insert on public.activities
  for each row execute function public.notify_group();
drop trigger if exists notify_exam on public.exams;
create trigger notify_exam after insert on public.exams
  for each row execute function public.notify_group();
drop trigger if exists notify_status on public.subject_status;
create trigger notify_status after insert or update on public.subject_status
  for each row execute function public.notify_group();

-- ---------------------------------------------------------------------------
-- Tiempo real: la app se actualiza sola cuando alguien carga algo
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'subject_status', 'study_sessions', 'activities', 'exams', 'exam_participants'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
