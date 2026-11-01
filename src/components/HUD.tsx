import { DEFAULT_SETTINGS, type Settings } from '../utils/settings';
import { useJavaScale } from '../utils/guiScale';
import { useEffect, useRef, useState } from 'react';
import type { HUDState } from '../game/engine';
import { I, displayName, durabilityMax } from '../game/items';
import { GAME_RELEASE_NAME, GAME_VERSION } from '../utils/version';
import { SkinHead } from './SkinPicker';
import { airSprite, armorSprite, foodSprite, guiSprite, heartSprite } from '../game/art/uiSprites';

const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
const BUBBLE = ['.XXX.', 'X..XX', 'X.XXX', 'XXXXX', '.XXX.'];

const outline = 'drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000)';

/**
 * 2.18: serca, głód i powietrze rysujemy grafiką z paczki (`gui/sprites/hud`).
 * Gdyby jej zabrakło (starszy build), zostaje pikselowy rysunek SVG.
 */
function PackIcon({ src, size, alt = '' }: { src: string | null; size: number; alt?: string }) {
  if (!src) return null;
  return <img src={src} width={size} height={size} className="pixelated" alt={alt} draggable={false} />;
}

function Heart({ fill }: { fill: 0 | 1 | 2 }) {
  const src = heartSprite(fill);
  if (src) {
    return (
      <span style={{ filter: outline, display: 'inline-flex' }}>
        <PackIcon src={src} size={18} />
      </span>
    );
  }
  return (
    <svg width={18} height={16} viewBox="0 0 7 6" style={{ filter: outline }} shapeRendering="crispEdges">
      {HEART.flatMap((row, y) =>
        row.split('').map((c, x) => {
          if (c !== 'X') return null;
          let color = '#3b0a0a';
          if (fill === 2 || (fill === 1 && x < 4)) color = y === 1 && x === 1 ? '#ffb0b0' : '#d91616';
          return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} />;
        })
      )}
    </svg>
  );
}

function Bubble({ pop }: { pop: boolean }) {
  const src = airSprite(pop);
  if (src) return <PackIcon src={src} size={16} />;
  return (
    <svg width={16} height={16} viewBox="0 0 5 5" style={{ filter: outline, opacity: pop ? 0.25 : 1 }} shapeRendering="crispEdges">
      {BUBBLE.flatMap((row, y) =>
        row.split('').map((c, x) =>
          c === 'X' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#3a8ee6" /> : null
        )
      )}
      <rect x={1} y={1} width={1} height={1} fill="#fff" />
    </svg>
  );
}

function Drumstick({ fill }: { fill: 0 | 1 | 2 }) {
  const src = foodSprite(fill);
  if (src) {
    return (
      <span style={{ filter: outline, display: 'inline-flex' }}>
        <PackIcon src={src} size={18} />
      </span>
    );
  }
  const meat = fill === 0 ? '#4a2a12' : '#c47a32';
  const bone = fill === 0 ? '#3a3a3a' : '#f2efe6';
  return (
    <svg width={18} height={16} viewBox="0 0 8 7" style={{ filter: outline }} shapeRendering="crispEdges">
      <rect x={1} y={1} width={4} height={3} fill={meat} />
      <rect x={1} y={1} width={1} height={1} fill={fill ? '#f0c090' : meat} />
      <rect x={4} y={3} width={3} height={1} fill={bone} />
      <rect x={5} y={4} width={2} height={2} fill={bone} />
      {fill === 1 && <rect x={3} y={1} width={2} height={3} fill="#4a2a12" />}
    </svg>
  );
}

export function Hotbar({ hud, icons, onSelect, onSwapHands }: { hud: HUDState; icons: Record<number, string>; onSelect?: (i: number) => void; onSwapHands?: () => void }) {
  return <div className="java-hotbar" style={{ position: 'relative', width: 182, height: 22, backgroundImage: `url(${guiSprite('hotbar')})`, backgroundSize: '100% 100%', imageRendering: 'pixelated' }}>
    <img alt="" src={guiSprite('hotbar_selection')!} style={{ position: 'absolute', left: hud.selected * 20 - 1, top: -1, width: 24, height: 23, imageRendering: 'pixelated' }} />
    {hud.offhand && <button type="button" aria-label="Druga ręka — zamień ręce (F)" onClick={onSwapHands} onPointerDown={e => e.stopPropagation()} style={{ position: 'absolute', left: -29, top: -1, width: 29, height: 24, border: 0, background: `url(${guiSprite('hotbar_offhand')}) center/100% 100%`, pointerEvents: 'auto' }}><img src={icons[hud.offhand.id]} alt="" width={16} height={16} className="pixelated" />{hud.offhand.count > 1 && <span className="java-count">{hud.offhand.count}</span>}</button>}
    {hud.hotbar.map((s, i) => <div key={i} aria-current={i === hud.selected ? 'true' : undefined} className="java-hotbar-slot" onPointerDown={onSelect ? e => { e.stopPropagation(); onSelect(i); } : undefined} style={{ position: 'absolute', left: 3 + i * 20, top: 3, width: 16, height: 16, pointerEvents: onSelect ? 'auto' : undefined }}>
      {s && <img src={icons[s.id]} alt="" width={16} height={16} className="pixelated" />}{s && s.count > 1 && <span className="java-count">{s.count}</span>}
      {s?.ench && <span className="ench-glint" />}
      {s?.dur !== undefined && s.dur < durabilityMax(s.id) && <span className="dur-bar" style={{ height: 2, left: 1, right: 2, bottom: 1 }}><i style={{ width: `${s.dur / durabilityMax(s.id) * 100}%`, background: '#3dba3d' }} /></span>}
    </div>)}
  </div>;
}

function JavaVitals({ hud, icons, onSelect, onSwapHands }: { hud: HUDState; icons: Record<number, string>; onSelect?: (i: number) => void; onSwapHands?: () => void }) {
  const scale = useJavaScale();
  return <div className="java-vitals" style={{ position: 'absolute', bottom: 'env(safe-area-inset-bottom,0px)', left: '50%', width: 182, height: 60, transform: `translateX(-50%) scale(${scale})`, transformOrigin: 'bottom center', imageRendering: 'pixelated' }}>
    {hud.mode === 'survival' && <>
      <div data-java-health style={{ position: 'absolute', top: 21, left: 0, display: 'flex', width: 81 }}>{Array.from({ length: 10 }, (_, i) => <Heart key={i} fill={hud.health - i * 2 >= 2 ? 2 : hud.health - i * 2 >= 1 ? 1 : 0} />)}</div>
      <div data-java-food style={{ position: 'absolute', top: 21, right: 0, display: 'flex', flexDirection: 'row-reverse', width: 81 }}>{Array.from({ length: 10 }, (_, i) => <Drumstick key={i} fill={hud.hunger - i * 2 >= 2 ? 2 : hud.hunger - i * 2 >= 1 ? 1 : 0} />)}</div>
      {hud.armorPoints > 0 && <div data-java-armor style={{ position: 'absolute', top: 11, left: 0, display: 'flex' }}>{Array.from({ length: 10 }, (_, i) => <img key={i} alt="" src={armorSprite(hud.armorPoints - i * 2 >= 2 ? 2 : hud.armorPoints - i * 2 >= 1 ? 1 : 0)!} width={9} height={9} style={{ marginRight: -1 }} />)}</div>}
      {(hud.underwater || hud.air < hud.maxAir) && <div data-java-air style={{ position: 'absolute', right: 0, top: 11, display: 'flex', flexDirection: 'row-reverse' }}>{Array.from({ length: Math.min(10, Math.ceil(hud.air / hud.maxAir * 10)) }, (_, i) => <Bubble key={i} pop={false} />)}</div>}
      <div data-java-xp style={{ position: 'absolute', top: 31, width: 182, height: 5, backgroundImage: `url(${guiSprite('exp_background')})`, backgroundSize: '182px 5px' }}><div style={{ width: `${Math.max(0, Math.min(1, hud.xpFrac)) * 100}%`, height: 5, backgroundImage: `url(${guiSprite('exp_progress')})`, backgroundSize: '182px 5px' }} /></div>
      {hud.level > 0 && <span style={{ position: 'absolute', top: 21, left: '50%', transform: 'translateX(-50%)', color: '#80ff20', fontSize: 8, lineHeight: '9px', textShadow: '1px 0 #000,-1px 0 #000,0 1px #000,0 -1px #000' }}>{hud.level}</span>}
    </>}
    <div style={{ position: 'absolute', top: 38 }}><Hotbar hud={hud} icons={icons} onSelect={onSelect} onSwapHands={onSwapHands} /></div>
  </div>;
}

export default function HUD({ hud, chatSettings = DEFAULT_SETTINGS, chatOpen = false, icons, minimap, touchControls, onSelectSlot, onSwapHands, onTpaAccept, onTpaDeny }: {
  hud: HUDState;
  chatSettings?: Pick<Settings, 'chatVisible'|'chatOpacity'|'chatBackground'|'chatWidth'|'chatScale'|'chatLines'>;
  chatOpen?: boolean;
  icons: Record<number, string>;
  minimap?: HTMLCanvasElement | null;
  touchControls?: boolean;
  onSelectSlot?: (i: number) => void;
  onSwapHands?: () => void;
  /** 2.19: przyciski zgody na teleportację (działają też na telefonie). */
  onTpaAccept?: () => void;
  onTpaDeny?: () => void;
}) {
  const scale = useJavaScale();
  const [label, setLabel] = useState<{ text: string; key: number } | null>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const sel = hud.hotbar[hud.selected];
  const selId = sel ? sel.id : -1;

  useEffect(() => {
    if (selId < 0) { setLabel(null); return; }
    setLabel({ text: sel?.name || displayName(selId), key: Date.now() });
    const t = setTimeout(() => setLabel(null), 2600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, hud.selected]);

  useEffect(() => {
    const dst = mapRef.current;
    if (!dst || !minimap || !hud.minimap) return;
    const ctx = dst.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(minimap, 0, 0, dst.width, dst.height);
  });

  const [tabList, setTabList] = useState(false);
  useEffect(() => {
    if (!hud.locked) setTabList(false);
    const key = (e: KeyboardEvent) => { if (e.code !== 'Tab' || !hud.locked) return; e.preventDefault(); setTabList(e.type === 'keydown'); };
    const clear = () => setTabList(false);
    window.addEventListener('keydown', key); window.addEventListener('keyup', key); window.addEventListener('blur', clear);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('keyup', key); window.removeEventListener('blur', clear); };
  }, [hud.locked]);

  const hours = Math.floor(((hud.time * 24 + 6) % 24));
  const mins = Math.floor(((hud.time * 24 * 60) % 60));

  return (
    <div className="pointer-events-none absolute inset-0 z-30 select-none">
      {/* overlays */}
      {hud.underwater && <div className="absolute inset-0" style={{ background: 'rgba(20,60,160,0.35)' }} />}
      {hud.inLava && <div className="absolute inset-0" style={{ background: 'rgba(230,90,10,0.6)' }} />}
      {hud.hurtCount > 0 && <div key={hud.hurtCount} className="hurt-flash absolute inset-0" style={{ background: 'radial-gradient(circle, rgba(255,0,0,0.1) 30%, rgba(200,0,0,0.7))' }} />}
      {hud.mode === 'survival' && hud.health <= 6 && hud.health > 0 && (
        <div
          className="low-health absolute inset-0"
          style={{ background: 'radial-gradient(circle, rgba(120,0,0,0) 45%, rgba(190,0,0,0.55) 100%)' }}
        />
      )}

      {/* 2.3: przy lornetcie celownik znika, a ramka zasłania kąty widzenia */}
      {hud.zoom && (
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 34%, rgba(0,0,0,0.85) 72%)' }} />
      )}

      {/* 2.19: prośba o teleportację – duże przyciski, żeby dało się zgodzić
          jednym dotknięciem także na telefonie. */}
      {hud.tpa && (
        <div className="pointer-events-auto absolute left-1/2 top-[22%] z-40 w-[min(420px,calc(100vw-24px))] -translate-x-1/2 border-2 border-black bg-[#2b2b2b]/95 p-3 text-center shadow-[0_8px_24px_rgba(0,0,0,0.55)]">
          <div className="mc-text text-sm text-yellow-200">{hud.tpa.name} prosi o teleportację do Ciebie</div>
          <div className="mt-1 text-[11px] leading-snug text-white/60">Po zgodzie pojawi się obok Ciebie tam, gdzie właśnie stoisz.</div>
          <div className="mt-2 flex justify-center gap-2">
            <button type="button" className="mc-btn mc-btn-primary !w-auto !px-4 !py-2 !text-[14px]" onClick={onTpaAccept}>
              ✔ Przyjmij
            </button>
            <button type="button" className="mc-btn !w-auto !px-4 !py-2 !text-[14px]" onClick={onTpaDeny}>
              ✖ Odmów
            </button>
          </div>
        </div>
      )}
      {hud.tpaSent && (
        <div className="absolute left-1/2 top-[16%] -translate-x-1/2 border border-white/10 bg-black/55 px-3 py-1 text-[12px] text-white/80">
          Czekam na zgodę: {hud.tpaSent.name}… <span className="opacity-60">(/tpaccept u niego)</span>
        </div>
      )}

      {/* crosshair – 2.18: obrazek z paczki, z pikselowym fallbackiem */}
      {!hud.zoom && guiSprite('crosshair') && (
        <img
          src={guiSprite('crosshair')!}
          width={15 * scale}
          height={15 * scale}
          className="pixelated absolute left-1/2 top-1/2"
          style={{ transform: 'translate(-50%,-50%)', mixBlendMode: 'difference' }}
          alt=""
          draggable={false}
          aria-hidden="true"
        />
      )}
      {!hud.zoom && !guiSprite('crosshair') && (
        <div className="absolute left-1/2 top-1/2" style={{ transform: 'translate(-50%,-50%)' }} aria-hidden="true">
          <div style={{ position: 'absolute', left: -10, top: -2.5, width: 20, height: 5, background: 'rgba(0,0,0,0.55)' }} />
          <div style={{ position: 'absolute', left: -2.5, top: -10, width: 5, height: 20, background: 'rgba(0,0,0,0.55)' }} />
          <div style={{ position: 'absolute', left: -9, top: -1.5, width: 18, height: 3, background: '#fff', boxShadow: '0 0 3px rgba(0,0,0,0.5)' }} />
          <div style={{ position: 'absolute', left: -1.5, top: -9, width: 3, height: 18, background: '#fff', boxShadow: '0 0 3px rgba(0,0,0,0.5)' }} />
          <div style={{ position: 'absolute', left: -1, top: -1, width: 2, height: 2, background: 'rgba(255,255,255,0.85)' }} />
        </div>
      )}

      {/* 2.3: stan wędkarstwa nad celownikiem (2.5: treść wg wersji sterowania) */}
      {touchControls && hud.fishing && hud.fishing !== 'idle' && (
        <div className="absolute left-1/2 top-[58%] -translate-x-1/2 px-2 py-0.5 text-sm mc-text" style={{ background: 'rgba(0,0,0,0.45)' }}>
          {hud.fishing === 'bite' ? (touchControls ? '🎣 Brań! Dotknij, aby zaciągnąć' : '🎣 Brań! Kliknij, aby zaciągnąć') : hud.fishing === 'waiting' ? '🎣 Przynęta czeka…' : '🎣 Przynęta leci…'}
        </div>
      )}

      {/* 2.2: aktywny punkt podróży — strzałka obraca się względem kierunku patrzenia. */}
      {hud.waypoint && !hud.debug && (
        <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 border border-black bg-black/60 px-3 py-1 text-sm mc-text">
          <span className="inline-block text-lg text-yellow-300" style={{ transform: `rotate(${hud.waypoint.bearing}rad)` }}>↑</span>
          <span className="max-w-[45vw] truncate text-yellow-100">{hud.waypoint.name}</span>
          <span className="whitespace-nowrap text-white/80">{Math.round(hud.waypoint.distance)} m · {hud.waypoint.direction}</span>
        </div>
      )}

      {/* wskazówka o istocie pod celownikiem (1.6) */}
      {hud.mobHint && touchControls && !hud.debug && (
        <div className="absolute left-1/2 top-[54%] -translate-x-1/2 px-2 py-0.5 text-sm mc-text" style={{ background: 'rgba(0,0,0,0.45)' }}>
          {hud.mobHint}
        </div>
      )}

      {/* debug */}
      {hud.debug ? (
        <div className="absolute left-2 top-2 space-y-0.5 text-[15px] leading-tight">
          {[
            `BlockCraft ${GAME_VERSION} „${GAME_RELEASE_NAME}” (${hud.fps} fps, skala ${Math.round(hud.resScale * 100)}%, ${hud.drawCalls} kresleń)`,
            // 2.28: profil automatu jakości – widać, czy gra właśnie oszczędza.
            `Jakość: ${hud.perf} · LOD: ${hud.lodRange > 0 ? `${hud.lodRange} bloków` : 'wyłączony'}`,
            `XYZ: ${hud.pos[0].toFixed(2)} / ${hud.pos[1].toFixed(2)} / ${hud.pos[2].toFixed(2)}`,
            `Blok: ${Math.floor(hud.pos[0])} ${Math.floor(hud.pos[1])} ${Math.floor(hud.pos[2])}`,
            `Chunk: ${Math.floor(hud.pos[0] / 16)} ${Math.floor(hud.pos[2] / 16)}  (załadowane: ${hud.chunks})`,
            `Kierunek: ${hud.facing}`,
            `Biom: ${hud.biome}`,
            `Czas: dzień ${hud.day}, ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`,
            `Świat: ${hud.worldName} (${hud.worldType === 'flat' ? 'płaski' : 'normalny'})`,
            `Moby: ${hud.mobs}`,
            `Wioska: ${hud.village ?? 'brak'}  ·  wymiany: ${hud.trades}`,
            `Cel: ${hud.target}`,
            `Ziarno: ${hud.seed}`,
            `Tryb: ${hud.mode === 'creative' ? 'Kreatywny' : 'Przetrwanie'}${hud.flying ? ' (lot)' : ''}${hud.sprinting ? ' sprint' : ''} · sterowanie: ${hud.touch ? 'dotyk' : 'PC'}`,
            `Głód: ${hud.hunger.toFixed(1)}  Pogoda: ${hud.weather === 'rain' ? 'deszcz' : 'jasno'}`,
            `Poziom: ${hud.level} (${Math.round(hud.xpFrac * 100)}% do następnego)  Pancerz: ${hud.armorPoints} pkt`,
          ].map((l, i) => (
            <div key={i} className="w-fit px-1" style={{ background: 'rgba(0,0,0,0.45)' }}>
              {l}
            </div>
          ))}
        </div>
      ) : hud.showFps ? (
        <div className="absolute left-2 top-2 px-1.5 py-0.5 text-[13px] leading-tight mc-text" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div>{hud.fps} FPS{hud.resScale < 1 ? ` · skala ${Math.round(hud.resScale * 100)}%` : ''}{hud.perf !== 'pełny' ? ` · ${hud.perf}` : ''}</div>
          <div className="opacity-70">chunki: {hud.chunks} · kresl.: {hud.drawCalls}</div>
        </div>
      ) : null}

      {hud.toast && <div className="java-advancement" style={{ position:'absolute',right:0,top:0,width:160,height:32,transform:`scale(${scale})`,transformOrigin:'top right',backgroundImage:`url(${guiSprite('toast_advancement')})`,backgroundSize:'100% 100%',imageRendering:'pixelated',fontSize:8,lineHeight:'9px',textShadow:'1px 1px #3f3f3f' }} title={hud.toast.text}>
        <img src={icons[I.BOOK]} width={16} height={16} alt="" style={{position:'absolute',left:8,top:8}} />
        <span style={{position:'absolute',left:30,top:7,color:'#ffff55'}}>Postęp osiągnięty!</span><span style={{position:'absolute',left:30,top:18,maxWidth:126,whiteSpace:'nowrap',overflow:'hidden'}}>{hud.toast.title}</span>
      </div>}
      {(hud.players?.length ?? 0) > 0 && hud.locked && tabList && <div className="java-player-list" style={{position:'absolute',left:'50%',top:10*scale,transform:`translateX(-50%) scale(${scale})`,transformOrigin:'top center',background:'#0008',padding:1,fontSize:8,lineHeight:'9px',display:'grid',gridAutoFlow:'column',gridTemplateRows:`repeat(${Math.min(20,hud.players!.length)},10px)`,gap:'0 4px'}}>
        {hud.players!.map(p => <div key={p.id} style={{width:140,display:'flex',alignItems:'center',gap:2,background:'#ffffff18',padding:'0 1px',whiteSpace:'nowrap'}}>
          <SkinHead skin={p.skin || 'steve'} size={8} /><span style={{flex:1,overflow:'hidden'}}>{p.name}</span>
          <span aria-label={`Ping: ${p.ping} ms`} title={`${p.ping} ms`} style={{display:'flex',alignItems:'end',gap:1,height:7}}>{[2,3,4,5,6].map((h,i)=><i key={i} style={{width:1,height:h,background:p.ping>=0 && i<(p.ping<150?5:p.ping<300?4:p.ping<600?3:p.ping<1000?2:1)?'#00ff00':'#555'}} />)}</span>
        </div>)}
      </div>}

      {hud.minimap && (
        <div className="absolute right-3 top-3 hidden flex-col items-center gap-1 sm:flex">
          <div className="relative" style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.55))' }}>
            <canvas
              ref={mapRef}
              width={96}
              height={96}
              className="pixelated block"
              style={{ width: 116, height: 116, border: '2px solid #0b0b0b', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)', background: '#0c0e12' }}
            />
            <span
              className="pointer-events-none absolute left-1/2 top-0.5 -translate-x-1/2 text-[10px] font-bold"
              style={{ color: '#ffe066', textShadow: '1px 1px 0 #000' }}
            >
              N
            </span>
          </div>
          <div className="px-1.5 py-0.5 text-[10px] leading-none mc-text" style={{ background: 'rgba(0,0,0,0.5)' }}>
            {hud.biome} · dzień {hud.day}
          </div>
        </div>
      )}

      {/* chat messages */}
      <div className="hud-chat java-chat-log absolute" aria-hidden={!(chatSettings.chatVisible || chatOpen)} style={{display:(chatSettings.chatVisible || chatOpen) ? undefined : 'none',opacity:chatSettings.chatOpacity,left:2*scale,bottom:40*scale,width:320*scale*chatSettings.chatWidth,maxWidth:'calc(100vw - 4px)'}}>
        {hud.messages.slice(-chatSettings.chatLines).map((m, i) => (
          <div key={i + '-' + m.t} className="mc-text" style={{ padding: `0 ${2*scale}px`, fontSize:8*scale*chatSettings.chatScale,lineHeight:`${9*scale*chatSettings.chatScale}px`,background: `rgba(0,0,0,${chatSettings.chatBackground})` }}>
            {m.text}
          </div>
        ))}
      </div>

      {label && <div key={label.key} className="java-held-label absolute left-1/2 -translate-x-1/2 text-center mc-text" style={{ bottom: 59*scale, fontSize: 8*scale }}>{label.text}</div>}
      <JavaVitals hud={hud} icons={icons} onSelect={onSelectSlot} onSwapHands={onSwapHands} />

      {hud.loading < .5 && <div style={{ position:'absolute',left:'50%',top:'50%',width:200,textAlign:'center',fontSize:8,lineHeight:'10px',transform:`translate(-50%,-50%) scale(${scale})` }}>
        Wczytywanie terenu… {Math.round(hud.loading*100)}%
        <div style={{ marginTop:8,height:5,border:'1px solid #808080',background:'#000' }}><div style={{ height:3,width:`${hud.loading*100}%`,background:'#fff' }} /></div>
      </div>}
    </div>
  );
}
