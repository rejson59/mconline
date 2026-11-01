import { useEffect, useState } from 'react';
import { loadSettings } from './settings';
/** Java's GUI keeps a minimum 320×240 logical canvas and uses integer zoom. */
export function javaGuiScale(width: number, height: number, requested = 0): number {
  let scale = 1;
  while (scale < (requested || 16) && width / (scale + 1) >= 320 && height / (scale + 1) >= 240) scale++;
  return Math.min(scale, width / 320, height / 240);
}
export function useJavaScale(requested?: number) {
  const measure = () => typeof window === 'undefined' ? 2 : javaGuiScale(window.innerWidth, window.innerHeight, requested ?? loadSettings().guiScale);
  const [scale, setScale] = useState(measure);
  useEffect(() => {
    const fit = () => setScale(measure());
    fit(); window.addEventListener('resize', fit); window.addEventListener('gui-scale', fit);
    return () => { window.removeEventListener('resize', fit); window.removeEventListener('gui-scale', fit); };
  }, [requested]); // settings save dispatches gui-scale within the same document
  return scale;
}
