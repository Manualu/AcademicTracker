import { createAvatar } from "@dicebear/core";
import * as adventurer from "@dicebear/adventurer";
import * as bigSmile from "@dicebear/big-smile";
import * as bottts from "@dicebear/bottts";
import * as funEmoji from "@dicebear/fun-emoji";
import * as lorelei from "@dicebear/lorelei";
import * as notionists from "@dicebear/notionists";
import * as pixelArt from "@dicebear/pixel-art";
import * as thumbs from "@dicebear/thumbs";
import type { AvatarConfig } from "./types";

// Avatares de DiceBear (dicebear.com). Créditos de cada estilo en la pantalla de perfil.
export const AVATAR_STYLES = {
  bottts: { name: "Robot", style: bottts, credit: "Bottts, de Pablo Stanley" },
  notionists: { name: "Boceto", style: notionists, credit: "Notionists, de Zoish (CC0)" },
  adventurer: { name: "Aventura", style: adventurer, credit: "Adventurer, de Lisa Wischofsky (CC BY 4.0)" },
  lorelei: { name: "Línea", style: lorelei, credit: "Lorelei, de Lisa Wischofsky (CC0)" },
  funEmoji: { name: "Emoji", style: funEmoji, credit: "Fun Emoji, de Davis Uche (CC BY 4.0)" },
  pixelArt: { name: "Píxel", style: pixelArt, credit: "Pixel Art, de DiceBear (CC0)" },
  bigSmile: { name: "Sonrisa", style: bigSmile, credit: "Big Smile, de Ashley Seo (CC BY 4.0)" },
  thumbs: { name: "Pulgar", style: thumbs, credit: "Thumbs, de DiceBear (CC0)" },
} as const;

export type AvatarStyleKey = keyof typeof AVATAR_STYLES;

export const AVATAR_BGS = ["FFC21A", "9AD0EC", "B7E4C7", "F4B6C2", "C9B6F2", "FFD6A5", "E2E8F0", "14213D"];

const cache = new Map<string, string>();

export function avatarUri(cfg: AvatarConfig): string {
  const k = `${cfg.style}|${cfg.seed}|${cfg.bg}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const def = AVATAR_STYLES[cfg.style as AvatarStyleKey] ?? AVATAR_STYLES.bottts;
  // Las opciones varían por estilo; seed y fondo son comunes a todos
  const uri = createAvatar(def.style as Parameters<typeof createAvatar>[0], {
    seed: cfg.seed,
    backgroundColor: [cfg.bg],
    radius: 0,
  }).toDataUri();
  cache.set(k, uri);
  return uri;
}

export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}
