import { useEffect, useMemo, useRef } from "react";
import { createScene, type ParkScene, type ParkSelection } from "../iso/park";
import { applyWorld, buildWorld, type ParkWorld } from "../lib/park";
import { backend, useStore } from "../lib/store";

/** Mundo del parque calculado con los datos del grupo (y cargado en el motor). */
export function useParkWorld(): ParkWorld {
  const { data } = useStore();
  const world = useMemo(() => buildWorld(data, backend.isDemo), [data]);
  applyWorld(world);
  return world;
}

/** Lienzo del parque. `compact` = vista chica sin interacción (la tarjeta del inicio). */
export function ParkCanvas({ compact, onSelect, sceneRef, label }: {
  compact?: boolean;
  onSelect?: (s: ParkSelection | null) => void;
  sceneRef?: React.MutableRefObject<ParkScene | null>;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cb = useRef(onSelect);
  cb.current = onSelect;
  useEffect(() => {
    const scene = createScene({ compact });
    scene.init(ref.current!, (s) => cb.current?.(s));
    scene.start();
    if (sceneRef) sceneRef.current = scene;
    return () => { scene.destroy(); if (sceneRef) sceneRef.current = null; };
  }, [compact, sceneRef]);
  return <canvas ref={ref} className="park-canvas" role="img" aria-label={label} />;
}
