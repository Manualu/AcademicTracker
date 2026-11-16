// Doble toque: si algo tarda o la pantalla cambia justo debajo del dedo, el segundo toque
// cae sobre OTRO botón (Seguir → Pausa, "Descanso" → "Terminar el pomodoro"). Se ignora
// el toque que llega a menos de GUARD_MS de uno anterior ya aceptado. Los botones que se
// tocan seguido a propósito (el +/− de minutos) quedan afuera.
const GUARD_MS = 350;
const TARGETS = "button, a, [role=button], [role=radio], [role=tab], .chip";
const REPEATABLE = ".stepper, [data-repeat], input, select, textarea, label";

export function installTapGuard() {
  let last = 0;
  document.addEventListener("click", (e) => {
    const el = e.target instanceof Element ? e.target : null;
    if (!el || !el.closest(TARGETS) || el.closest(REPEATABLE)) return;
    const t = performance.now();
    if (t - last < GUARD_MS) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); return; }
    last = t;
  }, true);
}
