# Remontada

App web instalable (PWA) para el Tratado de la Remontada: horas de estudio con cronómetro estilo Forest, actividad física, exámenes compartidos, avance de la carrera, rankings y avisos al grupo.

## Qué tiene

- **Estudiar**: cronómetro con cuenta regresiva (25 min, 50 min, 1 h 30, 2 h) o libre, y carga manual. Cada sesión fabrica una pieza para tu planta: tornillo, engranaje, motor, torno, brazo robótico o alto horno según la duración. Si cortás la cuenta regresiva antes, las horas cuentan igual pero sale chatarra.
- **Modo avión**: la app queda guardada en el celular y abre sin conexión. El cronómetro calcula el tiempo con la hora de inicio, así que sigue contando con la pantalla bloqueada o con la app cerrada. Lo que cargás sin señal (sesiones, actividad, exámenes, materias) queda en una cola en el celular y se sube solo cuando vuelve la conexión.
- **Inicio**: avance de la semana (14 h, contadas de lunes a domingo) con el ritmo esperado, actividad física (3 por semana), próximo examen, tu planta de la semana y lo que hace el grupo en vivo.
- **Ranking**: tres tablas (horas, actividad física y constancia), cada una en versión semanal o histórica (desde el 9/10/2026, fecha del tratado).
- **Exámenes**: calendario del grupo. Uno agenda el examen y los demás que lo rinden se suman.
- **Carrera**: elegís carrera y plan (los 25 planes de FIUBA) y marcás cada materia como pendiente, cursando, regularizada o aprobada. La app indica qué correlativas faltan y permite ver el mapa de los demás.
- **Perfil**: avatar de DiceBear (8 estilos), inventario de la planta, 18 trofeos y configuración de avisos.
- **Avisos push**: "Berni sumó 2 h de Probabilidad" en el momento; 8:30 recordatorio de la foto; 7 días y 1 día antes de cada examen; domingo a las 12 si te falta algo para cerrar la semana; lunes a las 9 el resumen con el ranking.

## Cómo está armada

| Parte | Tecnología | Por qué |
|---|---|---|
| App | React + TypeScript + Vite, `vite-plugin-pwa` | Un solo código para Android, iPhone y compu, instalable, con service worker para funcionar sin conexión |
| Base de datos, login y tiempo real | Supabase (Postgres) | Mail y contraseña, permisos por fila, actualizaciones en vivo y plan gratuito. Los rankings salen de consultas simples |
| Avisos push | Edge Functions de Supabase + `web-push` + `pg_cron` | Avisos sin depender de Firebase; la base llama a la función en cada carga y a horario fijo |
| Hosting | Cualquier hosting estático (Vercel, Netlify, Cloudflare Pages) | La app es solo archivos estáticos |

Si no configurás Supabase, la app arranca en **modo demo** con un grupo inventado y los datos guardados en el navegador.

## Puesta en marcha (unos 30 minutos, una sola vez)

### 1. Supabase

1. Creá un proyecto gratis en [supabase.com](https://supabase.com). Te conviene la región São Paulo, que es la más cercana.
2. En **SQL Editor**, pegá y corré `supabase/migrations/0001_schema.sql` y después `supabase/migrations/0002_parque.sql` (el parque y el reciclaje de chatarra). Si ya tenías la base andando, alcanza con correr la 0002.
3. Todavía en el SQL Editor, cambiá los tres valores de configuración:
   ```sql
   update app_config set value = 'EL-CODIGO-DEL-GRUPO' where key = 'invite_code';
   update app_config set value = 'https://TU-REF.supabase.co/functions/v1' where key = 'functions_url';
   update app_config set value = 'un-secreto-largo-y-random' where key = 'notify_secret';
   ```
   El código de invitación es lo que van a escribir tus amigos al crear la cuenta. Sin ese código no se puede registrar nadie.
4. En **Authentication → Sign In / Providers → Email**, podés desactivar "Confirm email" para que no haga falta confirmar el mail.

### 2. Avisos push

```bash
npx web-push generate-vapid-keys        # te da una clave pública y una privada
npx supabase login
npx supabase link --project-ref TU-REF
npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:tu@mail.com NOTIFY_SECRET=el-mismo-secreto-del-paso-1
npx supabase functions deploy notify --no-verify-jwt
npx supabase functions deploy scheduled --no-verify-jwt
```

Después, en **Database → Extensions**, activá `pg_cron` y `pg_net`, y corré `supabase/cron.sql` en el SQL Editor.

### 3. La app

```bash
cp .env.example .env.local   # completá URL, anon key (Project Settings → API) y la clave VAPID pública
npm install
npm run dev                  # para probar en la compu
npm run build                # genera dist/
```

Para publicarla, subí el proyecto a un repositorio de GitHub e importalo en [Vercel](https://vercel.com) (framework: Vite). Cargá las tres variables `VITE_...` en la configuración del proyecto. Cada `git push` la actualiza sola.

### 4. Instalarla en el celular

- **Android (Chrome)**: abrí el link y tocá "Instalar app".
- **iPhone (Safari)**: Compartir → "Agregar a inicio". En iPhone los avisos push solo funcionan si la app está agregada a la pantalla de inicio (iOS 16.4 o posterior).
- Después: Perfil → Avisos → Activar.

## Límites conocidos

- **La primera vez que inicies sesión necesitás conexión.** Después funciona en modo avión.
- **Sin señal no llegan avisos push**, porque vienen de internet; se reciben al reconectar. Cuando termina el cronómetro con la pantalla bloqueada, la web no puede programar una alarma. Android a veces muestra el aviso igual; si no, la pieza aparece fabricada al abrir la app. Con la app abierta, suena y vibra.
- El plan gratuito de Supabase pausa los proyectos que pasan 7 días sin uso. Si lo usan todos los días, no pasa.
- Regla de "podés cursarla": correlativas regularizadas o aprobadas, y los créditos mínimos si la materia los pide. Para que exija correlativas aprobadas, cambiá `MINIMO_CORRELATIVA` en `src/lib/planes.ts`.

## Estructura

```
src/
  lib/store.tsx           datos, cola sin conexión y tiempo real
  lib/timer.tsx           cronómetro (funciona en modo avión)
  lib/stats.ts            rankings, rachas y resumen semanal
  lib/trophies.ts         trofeos
  lib/pieces.ts           piezas de la planta
  lib/planes.ts           planes de estudio y correlativas
  lib/supabaseBackend.ts  conexión con Supabase
  lib/demoBackend.ts      grupo inventado para el modo demo
  screens/                Inicio, Estudiar, Ranking, Exámenes, Carrera, Perfil, Login
  sw.ts                   service worker (sin conexión + push)
  data/planes/            planes de FIUBA (de FIUBA-Map)
supabase/
  migrations/0001_schema.sql   tablas, permisos, registro con código, avisos en vivo
  migrations/0002_parque.sql   reciclaje de chatarra y paso de "tornillo" al catálogo nuevo
  cron.sql                     avisos programados
  functions/notify             aviso al grupo cuando alguien carga algo
  functions/scheduled          8:30, exámenes, domingo y lunes
scripts/build-planes.mjs       regenera los planes desde FIUBA-Map
```

## Créditos

- Planes de estudio: [FIUBA-Map](https://github.com/fdelmazo/FIUBA-Map), de Federico del Mazo (MIT).
- Avatares: [DiceBear](https://www.dicebear.com). Bottts (Pablo Stanley), Notionists (Zoish, CC0), Adventurer (Lisa Wischofsky, CC BY 4.0), Lorelei (Lisa Wischofsky, CC0), Fun Emoji (Davis Uche, CC BY 4.0), Pixel Art (CC0), Big Smile (Ashley Seo, CC BY 4.0), Thumbs (CC0).

## Parque y piezas

- Cada sesión terminada sortea una pieza del catálogo (36 máquinas en 6 categorías). La duración define la categoría, la rareza sale al azar (62 % común, 26 % rara, 10 % épica, 2 % legendaria) y la materia inclina el sorteo hacia máquinas de su área (`src/lib/areas.ts` clasifica las casi mil materias de FIUBA por palabras clave).
- El sorteo usa el id de la sesión como semilla, así que es reproducible.
- El parque (`src/iso/park.js`) crece con las horas de todo el grupo desde la firma del tratado; cada uno tiene una nave que sube de nivel con sus propias horas. Tiene lugar para 4 naves.
- Si cambiás el catálogo, corré `npm run piezas` para regenerar los nombres que usan los avisos push.
- El Inicio es el parque: cada uno aparece como un personaje con su avatar en la vereda de su nave. Si está estudiando, su nave se prende con un globito que dice qué y hace cuánto (presencia en vivo con Supabase Realtime, sin tablas nuevas); si hizo actividad física hoy sale a trotar; si no estudió ni hoy ni ayer, se sienta en un banco con la nave apagada. Cada sesión nueva se festeja sobre la nave de quien la hizo.
