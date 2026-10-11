-- Permisos de tabla para los usuarios logueados.
-- Los proyectos nuevos de Supabase ya no dan acceso automático a las tablas creadas por SQL,
-- así que sin esto todo falla con "permission denied for table …".
-- Quién ve y edita qué fila lo siguen decidiendo las políticas (RLS) de 0001 y 0002.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.subject_status,
  public.study_sessions,
  public.activities,
  public.exams,
  public.exam_participants,
  public.push_subscriptions,
  public.recycles
to authenticated;

-- app_config sigue cerrada: solo la leen las funciones internas.
revoke all on public.app_config from anon, authenticated;
