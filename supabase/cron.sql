-- Avisos programados. Correr DESPUÉS de 0001_schema.sql y de desplegar la función "scheduled".
-- Requiere las extensiones pg_cron y pg_net (Database → Extensions en el panel de Supabase).
-- Horarios en UTC: Buenos Aires es UTC-3.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.run_scheduled(job text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  base   text;
  secret text;
begin
  select value into base   from public.app_config where key = 'functions_url';
  select value into secret from public.app_config where key = 'notify_secret';
  perform net.http_post(
    url     := base || '/scheduled',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', secret),
    body    := jsonb_build_object('job', job)
  );
end;
$$;
revoke all on function public.run_scheduled(text) from public, anon, authenticated;

-- Todos los días 8:30: recordatorio de la foto de las 9 (cláusula octava)
select cron.schedule('remontada-despertador', '30 11 * * *', $$select public.run_scheduled('wakeup')$$);
-- Todos los días 10:00: exámenes que son en 7 días y mañana
select cron.schedule('remontada-examenes',    '0 13 * * *',  $$select public.run_scheduled('exams')$$);
-- Domingos 12:00: aviso a quien le falten horas o actividad para cerrar la semana
select cron.schedule('remontada-empujon',     '0 15 * * 0',  $$select public.run_scheduled('nudge')$$);
-- Lunes 9:00: resumen de la semana que cerró, con el ranking
select cron.schedule('remontada-resumen',     '0 12 * * 1',  $$select public.run_scheduled('weekly')$$);
