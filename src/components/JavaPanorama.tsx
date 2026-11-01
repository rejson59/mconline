import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { guiSprite } from '../game/art/uiSprites';
/** Six vanilla panorama faces; low-resolution background, not six stretched DOM cards. */
export default function JavaPanorama() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current; if (!host || !window.WebGLRenderingContext) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false }); } catch { return; }
    renderer.setPixelRatio(1); host.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(85, 1, .1, 10);
    // Panorama order: front/right/back/left/up/down, CubeTexture order: +X/-X/+Y/-Y/+Z/-Z.
    const cube = new THREE.CubeTextureLoader().load([1,3,4,5,0,2].map(i => guiSprite(`panorama_${i}`)!));
    cube.colorSpace = THREE.SRGBColorSpace; scene.background = cube;
    const resize = () => { camera.aspect = host.clientWidth / Math.max(1, host.clientHeight); camera.updateProjectionMatrix(); renderer.setSize(Math.max(1, Math.round(host.clientWidth / 2)), Math.max(1, Math.round(host.clientHeight / 2)), false); };
    resize(); window.addEventListener('resize', resize);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let frame = 0, last = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw); if (now - last < 66 || document.hidden) return; last = now;
      camera.rotation.set(.16, reduced ? .1 : .1 + now * .000015, 0, 'YXZ'); renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); cube.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); };
  }, []);
  return <div ref={ref} className="java-panorama" aria-hidden="true" />;
}
