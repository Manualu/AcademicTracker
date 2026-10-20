\set ON_ERROR_STOP 0
\pset footer off
update app_config set value = 'REMONTADA2026' where key = 'invite_code';
update app_config set value = 'http://fake/functions/v1' where key = 'functions_url';
insert into auth.users values
 ('11111111-1111-1111-1111-111111111111','manu@x.com','{"display_name":"Manu","invite_code":"REMONTADA2026"}'),
 ('22222222-2222-2222-2222-222222222222','berni@x.com','{"display_name":"Berni","invite_code":"REMONTADA2026"}');

-- Como Manu (lo mismo que hace la app: upsert con onConflict id, ignoreDuplicates)
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
\echo '== 1) Guardar sesiones como lo hace la app (cronómetro, manual, chatarra, pomodoro)'
insert into study_sessions (id, subject_id, subject_name, started_at, minutes, source, outcome, piece) values
 ('aaaaaaaa-0000-0000-0000-000000000001','6103','Probabilidad','2026-10-20T13:05:00.000Z',50,'timer','completed','bomba'),
 ('aaaaaaaa-0000-0000-0000-000000000002',null,'Economía','2026-10-19T20:00:00.000Z',90,'manual','completed','torno'),
 ('aaaaaaaa-0000-0000-0000-000000000003','6103','Probabilidad','2026-10-20T02:40:00.000Z',12,'timer','abandoned','chatarra'),
 ('aaaaaaaa-0000-0000-0000-000000000004','6103','Probabilidad','2026-10-20T14:00:00.000Z',25,'timer','completed','engranaje')
on conflict (id) do nothing;
\echo '== 2) Reintento sin conexión (mismo id): no tiene que duplicar'
insert into study_sessions (id, subject_id, subject_name, started_at, minutes, source, outcome, piece) values
 ('aaaaaaaa-0000-0000-0000-000000000001','6103','Probabilidad','2026-10-20T13:05:00.000Z',50,'timer','completed','bomba')
on conflict (id) do nothing;
\echo '== 3) Lo que queda guardado (hora de Buenos Aires)'
select subject_name as materia, subject_id as codigo, to_char(started_at at time zone 'America/Argentina/Buenos_Aires','DD/MM HH24:MI') as inicio_ar,
       minutes as min, source, outcome, piece, user_id = auth.uid() as es_mio
from study_sessions order by started_at;
\echo '== 4) Avisos al grupo disparados por las cargas nuevas (no por el reintento)'
select count(*) as avisos from net.calls;
\echo '== 5) Datos inválidos que la base tiene que rechazar'
insert into study_sessions (id, subject_name, started_at, minutes, source, outcome, piece) values ('aaaaaaaa-0000-0000-0000-000000000009','X',now(),0,'timer','completed','x');
insert into study_sessions (id, subject_name, started_at, minutes, source, outcome, piece) values ('aaaaaaaa-0000-0000-0000-000000000009','X',now(),721,'timer','completed','x');
insert into study_sessions (id, subject_name, started_at, minutes, source, outcome, piece) values ('aaaaaaaa-0000-0000-0000-000000000009','',now(),10,'timer','completed','x');
insert into study_sessions (id, user_id, subject_name, started_at, minutes, source, outcome, piece) values ('aaaaaaaa-0000-0000-0000-000000000009','22222222-2222-2222-2222-222222222222','X',now(),10,'timer','completed','x');
\echo '== 6) Cambiar la materia de una sesión propia (lo que va a hacer el historial)'
update study_sessions set subject_name = 'Análisis Matemático II', subject_id = '6109' where id = 'aaaaaaaa-0000-0000-0000-000000000004';
select subject_name, subject_id, minutes, piece from study_sessions where id = 'aaaaaaaa-0000-0000-0000-000000000004';
select count(*) as avisos_tras_editar from net.calls;
\echo '== 7) Borrar una sesión propia'
delete from study_sessions where id = 'aaaaaaaa-0000-0000-0000-000000000003';
select count(*) as sesiones_de_manu from study_sessions;

-- Como Berni: puede ver las de Manu pero no tocarlas
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
\echo '== 8) Berni ve las sesiones del grupo'
select count(*) as visibles_para_berni from study_sessions;
\echo '== 9) Berni intenta editar y borrar una de Manu (tiene que afectar 0 filas)'
update study_sessions set subject_name = 'Hackeado' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
delete from study_sessions where id = 'aaaaaaaa-0000-0000-0000-000000000001';
\echo '== 10) Berni intenta pasarse una sesión de Manu a su nombre'
reset role;
select subject_name, user_id = '11111111-1111-1111-1111-111111111111' as sigue_siendo_de_manu from study_sessions where id = 'aaaaaaaa-0000-0000-0000-000000000001';
