import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { guiSprite } from '../game/art/uiSprites';
import { MENU_PANORAMAS } from '../game/art/menuPanoramas.generated';
import { panoramaPose, panoramaSize, type PanoramaScene } from '../utils/menuPanorama';

export function panoramaFaces(scene: PanoramaScene): readonly string[] {
  return scene === 'trails' ? Array.from({ length: 6 }, (_, i) => guiSprite(`panorama_${i}`)!) : MENU_PANORAMAS[scene];
}
/** Real six-face cube, not a zooming still. CSS panning is only the no-WebGL fallback. */
export default function JavaPanorama({ scene = 'trails', motion = true }: { scene?: PanoramaScene; motion?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const motionRef = useRef(motion), refresh = useRef(() => {});
  motionRef.current = motion;
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let disposed = false, loaded = false, lost = false, frame = 0;
    let previous: number | undefined, elapsed = 0;
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let reduced = media?.matches ?? false;
    let renderer: THREE.WebGLRenderer | undefined;
    const canMove = () => motionRef.current && !reduced;
    const fallback = () => {
      host.dataset.renderer = 'fallback';
      host.dataset.motion = canMove() && !document.hidden ? 'running' : 'paused';
    };
    fallback();
    try {
      if (window.WebGL2RenderingContext) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'low-power' });
        if (context) renderer = new THREE.WebGLRenderer({ canvas, context, antialias: false, alpha: false });
      }
    }
    catch { /* CSS fallback remains visible, including when WebGL is disabled. */ }
    const scene3d = new THREE.Scene(), camera = new THREE.PerspectiveCamera(85, 1, .1, 10);
    const draw = () => {
      if (!renderer || !loaded || disposed || lost) return;
      const pose = panoramaPose(elapsed);
      camera.rotation.set(THREE.MathUtils.degToRad(pose.pitch), THREE.MathUtils.degToRad(pose.yaw), 0, 'YXZ');
      renderer.render(scene3d, camera);
      host.dataset.renderer = 'webgl';
    };
    const animate = (now: number) => {
      frame = 0;
      if (disposed || lost || document.hidden || !canMove()) return;
      frame = requestAnimationFrame(animate);
      if (previous === undefined) { previous = now; return; }
      if (now - previous < 1000 / 30) return;
      elapsed += Math.min(.1, (now - previous) / 1000);
      previous = now;
      draw();
    };
    const sync = () => {
      cancelAnimationFrame(frame); frame = 0; previous = undefined;
      host.dataset.motion = canMove() && !document.hidden ? 'running' : 'paused';
      if (!document.hidden) draw();
      if (renderer && loaded && !lost && !document.hidden && canMove()) frame = requestAnimationFrame(animate);
    };
    refresh.current = sync;
    const resize = () => {
      if (!renderer || disposed) return;
      const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
      camera.aspect = width / height; camera.updateProjectionMatrix();
      const [w, h] = panoramaSize(width, height);
      renderer.setSize(w, h, false); sync();
    };
    const onLost = (event: Event) => { event.preventDefault(); lost = true; cancelAnimationFrame(frame); fallback(); };
    const onRestored = () => { lost = false; resize(); };
    const onReduced = () => { reduced = media?.matches ?? false; sync(); };
    let cube: THREE.CubeTexture | undefined;
    if (renderer) {
      renderer.setPixelRatio(1);
      renderer.domElement.addEventListener('webglcontextlost', onLost);
      renderer.domElement.addEventListener('webglcontextrestored', onRestored);
      host.appendChild(renderer.domElement);
      const faces = panoramaFaces(scene);
      // Minecraft front/right/back/left/up/down -> Three +X/-X/+Y/-Y/+Z/-Z.
      cube = new THREE.CubeTextureLoader().load([1, 3, 4, 5, 0, 2].map(i => faces[i]), () => {
        if (disposed) return;
        loaded = true; resize();
      }, undefined, () => { if (!disposed) { loaded = false; cancelAnimationFrame(frame); fallback(); } });
      cube.colorSpace = THREE.SRGBColorSpace; scene3d.background = cube;
      resize();
    }
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize);
    observer?.observe(host);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', sync);
    media?.addEventListener('change', onReduced);
    return () => {
      disposed = true; refresh.current = () => {};
      cancelAnimationFrame(frame); observer?.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', sync);
      media?.removeEventListener('change', onReduced);
      renderer?.domElement.removeEventListener('webglcontextlost', onLost);
      renderer?.domElement.removeEventListener('webglcontextrestored', onRestored);
      cube?.dispose(); renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove();
    };
  }, [scene]);
  useEffect(() => { refresh.current(); }, [motion]);
  return <div ref={ref} className="java-panorama" data-scene={scene} data-renderer="fallback" data-motion={motion ? 'running' : 'paused'} aria-hidden="true">
    <div className="java-panorama-fallback" style={{ backgroundImage: `url(${panoramaFaces(scene)[0]})` }} />
  </div>;
}
