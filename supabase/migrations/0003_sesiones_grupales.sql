-- Sesiones de estudio grupales: viven en el mismo calendario que los exámenes.
-- Usan la tabla exams con kind = 'grupal' (así comparten el "me sumo", los permisos y los avisos)
-- y una duración en minutos.

alter table public.exams drop constraint if exists exams_kind_check;
alter table public.exams add constraint exams_kind_check
  check (kind in ('parcial', 'recuperatorio', 'final', 'coloquio', 'otro', 'grupal'));

alter table public.exams add column if not exists duration_min integer
  check (duration_min is null or duration_min between 15 and 720);
