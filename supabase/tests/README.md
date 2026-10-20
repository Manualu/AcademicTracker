# Pruebas de la base

Prueban las migraciones contra un Postgres 16 local que imita lo mínimo de Supabase
(roles, `auth.users`, `auth.uid()`, `pg_net` y la publicación de Realtime).

```bash
createdb rem
psql -d rem -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/000*.sql; do sed 's/^create extension if not exists pg_net;.*$//' "$f" | psql -d rem -v ON_ERROR_STOP=1; done
psql -d rem -f supabase/tests/sesiones.sql
```

`sesiones.sql` guarda sesiones como lo hace la app (cronómetro, a mano, cortada, pomodoro),
reintenta una sin conexión (no se duplica), verifica los límites de la tabla, corrige la
materia, borra, y comprueba que otro usuario del grupo las ve pero no las puede tocar.
