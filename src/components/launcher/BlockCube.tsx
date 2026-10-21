/**
 * 2.24: sześcian bloku z prawdziwych tekstur paczki.
 *
 * Launcher pokazuje w nagłówku obracający się blok trawy – dokładnie ten sam
 * kafelek (trawa z góry, bok trawy, ziemia od spodu), którego używa świat gry.
 * Rysujemy go w CSS (bez canvasu i WebGL), więc działa też w testach SSR.
 */

import { BLOCK_ATLAS_PNG } from '../../game/art/vanillaArt.generated';
import { T } from '../../game/blocks';
import type { CSSProperties } from 'react';

const COLUMNS = 16;

/** Tło przycięte do jednego kafelka 16×16 z atlasu 256×256. */
export function tileBackground(tile: number): CSSProperties {
  const tx = tile % COLUMNS;
  const ty = Math.floor(tile / COLUMNS);
  return {
    backgroundImage: `url(${BLOCK_ATLAS_PNG})`,
    backgroundSize: '1600% 1600%',
    backgroundRepeat: 'no-repeat',
    // CSS wyrównuje procentowo: kafelek n jest w (n / (kolumny - 1)) * 100%.
    backgroundPosition: `${(-tx / (COLUMNS - 1)) * 100}% ${(-ty / (COLUMNS - 1)) * 100}%`,
    imageRendering: 'pixelated',
  };
}

const FACES: { key: string; transform: (s: number) => string; tile: number }[] = [
  { key: 'front', transform: (s) => `rotateY(0deg) translateZ(${s / 2}px)`, tile: T.grass_side },
  { key: 'back', transform: (s) => `rotateY(180deg) translateZ(${s / 2}px)`, tile: T.grass_side },
  { key: 'right', transform: (s) => `rotateY(90deg) translateZ(${s / 2}px)`, tile: T.grass_side },
  { key: 'left', transform: (s) => `rotateY(-90deg) translateZ(${s / 2}px)`, tile: T.grass_side },
  { key: 'top', transform: (s) => `rotateX(90deg) translateZ(${s / 2}px)`, tile: T.grass_top },
  { key: 'bottom', transform: (s) => `rotateX(-90deg) translateZ(${s / 2}px)`, tile: T.dirt },
];

export default function BlockCube({
  size = 132,
  spin = true,
  className = '',
}: {
  size?: number;
  spin?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size, perspective: size * 5 }}>
      <style>{`
        @keyframes bc-cube-spin {
          from { transform: rotateX(-22deg) rotateY(0deg); }
          to { transform: rotateX(-22deg) rotateY(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bc-cube-spin { animation: none !important; }
        }
      `}</style>
      <div
        className={spin ? 'bc-cube-spin' : undefined}
        style={{
          width: size,
          height: size,
          position: 'relative',
          transformStyle: 'preserve-3d',
          animation: spin ? 'bc-cube-spin 18s linear infinite' : undefined,
          transform: spin ? undefined : 'rotateX(-22deg) rotateY(32deg)',
        }}
      >
        {FACES.map((face) => (
          <div
            key={face.key}
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              ...tileBackground(face.tile),
              transform: face.transform(size),
              border: '1px solid rgba(0,0,0,0.28)',
              boxShadow: 'inset 0 0 24px rgba(0,0,0,0.18)',
            }}
          />
        ))}
      </div>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '12%',
          right: '12%',
          bottom: -size * 0.16,
          height: size * 0.2,
          background: 'radial-gradient(ellipse at center, rgba(52,211,153,0.35), rgba(52,211,153,0) 70%)',
          filter: 'blur(2px)',
        }}
      />
    </div>
  );
}
