-- Imitación mínima de Supabase: roles, auth.users, auth.uid(), pg_net y la publicación de Realtime
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
create schema net; create table net.calls (url text, body jsonb);
create function net.http_post(url text, headers jsonb default '{}', body jsonb default '{}') returns bigint language sql as $$ insert into net.calls values (url, body); select 1::bigint $$;
grant usage on schema net to authenticated; grant all on net.calls to authenticated; grant execute on function net.http_post(text,jsonb,jsonb) to authenticated;
create publication supabase_realtime;
