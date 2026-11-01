import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { isSlimSkin, playerSkinTexture, skinnedBox, skinnedHat } from '../game/skinArt';
import { ArmorVisual } from '../game/armorVisual';
import type { Stack } from '../game/inventory';
import { EquippedSkinAvatar } from './SkinPicker';
/** Actual textured 3D player, including equipment and pointer-following head/body. */
export default function JavaPlayerPreview({ skin, armor, scale }: { skin: string; armor: (Stack | null)[]; scale: number }) {
  const host = useRef<HTMLDivElement>(null), [ready, setReady] = useState(false);
  const equipment = armor.map(s => s?.id ?? 0).join(',');
  useEffect(() => {
    setReady(false);
    if (!host.current || !window.WebGLRenderingContext) return;
    const texture = playerSkinTexture(skin); if (!texture) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false }); } catch { return; }
    renderer.setPixelRatio(1); renderer.setSize(Math.round(52 * scale), Math.round(70 * scale), false);
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:52px;height:70px;image-rendering:pixelated;pointer-events:none';
    host.current.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), figure = new THREE.Group(), neck = new THREE.Group();
    const camera = new THREE.OrthographicCamera(-.85,.85,1.15,-1.15,.1,10); camera.position.set(0,1,-4); camera.lookAt(0,1,0);
    const slim = isSlimSkin(skin), armW = slim ? .1875 : .25;
    const part = (size: [number,number,number], name: Parameters<typeof skinnedBox>[1], x: number, y: number) => {
      const mesh = skinnedBox(size, name, texture, slim); mesh.position.set(x,y,0); figure.add(mesh); return mesh;
    };
    const body = part([.5,.75,.25], 'body',0,1.125);
    const head = skinnedBox([.5,.5,.5], 'head', texture, slim), hat = skinnedHat([.5,.5,.5],texture);
    head.position.y = hat.position.y = .25; neck.position.y = 1.5; neck.add(head,hat); figure.add(neck);
    const armL = part([armW,.75,.25], 'leftArm',-(.25+armW/2),1.125), armR = part([armW,.75,.25], 'rightArm',.25+armW/2,1.125);
    const legL = part([.25,.75,.25],'leftLeg',-.125,.375), legR = part([.25,.75,.25],'rightLeg',.125,.375);
    new ArmorVisual({ head:neck,body,armL,armR,legL,legR }).update(equipment.split(',').map(Number));
    scene.add(figure,new THREE.AmbientLight(0xffffff,2));
    const light = new THREE.DirectionalLight(0xffffff,2); light.position.set(-2,3,-3); scene.add(light);
    let frame = 0;
    const draw = () => { frame = 0; renderer.render(scene,camera); };
    const move = (e: MouseEvent) => {
      const rect = host.current?.getBoundingClientRect(); if (!rect) return;
      const yaw = Math.atan((e.clientX-(rect.left+rect.width/2))/(80*scale));
      const pitch = Math.atan((e.clientY-(rect.top+rect.height*.24))/(80*scale));
      figure.rotation.y = -yaw*.35; neck.rotation.y = -yaw*.5; neck.rotation.x = -pitch*.6;
      if (!frame) frame = requestAnimationFrame(draw);
    };
    draw(); setReady(true); window.addEventListener('mousemove',move);
    return () => {
      cancelAnimationFrame(frame); window.removeEventListener('mousemove',move);
      scene.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } });
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [skin,equipment,scale]);
  return <div ref={host} style={{ position:'relative',width:52,height:70 }} aria-label="Podgląd skórki 3D">
    {!ready && <EquippedSkinAvatar skin={skin} armor={armor} size={29} />}
  </div>;
}
