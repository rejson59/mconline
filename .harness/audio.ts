import { RESCUE_SOUND_FILES, RESCUE_SOUND_EVENTS } from '../src/game/art/javaRescue.generated';
/** Functional Web Audio graph tests. Actual OGG decoding is also browser-tested. */
import assert from 'node:assert/strict';
import * as Audio from '../src/game/audio';
import { B } from '../src/game/blocks';
import { DEFAULT_SOUND_LEVELS, SOUND_CATEGORIES } from '../src/utils/soundSettings';
import { JAVA_SOUND_EVENTS, JAVA_SOUND_FILES } from '../src/game/art/javaSounds.generated';
let checks=0;
const check=(name:string, value:unknown)=>{ assert.ok(value,name); checks++; };
class Node {
  connections:Node[]=[]; disconnected=false;
  gain={value:1,setValueAtTime(){},exponentialRampToValueAtTime(){}};
  pan={value:0};playbackRate={value:1};frequency={value:1};
  buffer:unknown;loop=false;started=false;stopped=false;onended:(()=>void)|null=null;type='';
  connect(n:Node){this.connections.push(n);return n;}
  disconnect(){this.disconnected=true;}
  start(){this.started=true;}
  stop(){this.stopped=true;this.onended?.();}
}
class Context {
  static instance:Context;
  state='running';currentTime=0;destination=new Node();gains:Node[]=[];sources:Node[]=[];pans:Node[]=[];decodes=0;
  constructor(){Context.instance=this;}
  createGain(){const n=new Node();this.gains.push(n);return n;}
  createStereoPanner(){const n=new Node();this.pans.push(n);return n;}
  createBufferSource(){const n=new Node();this.sources.push(n);return n;}
  createOscillator(){return new Node();}
  createDynamicsCompressor(){return Object.assign(new Node(),{threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0}});}
  async resume(){}
  async decodeAudioData(data:ArrayBuffer){this.decodes++;assert.equal(Buffer.from(data).subarray(0,4).toString(),'OggS');return {duration:.2};}
}
Object.assign(globalThis,{window:{AudioContext:Context}});
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
for (const [event,variants] of Object.entries(JAVA_SOUND_EVENTS)) {
  check(`event ${event} resolves to embedded originals`,variants.length>0 && variants.every(v=>!!JAVA_SOUND_FILES[v.name]));
}
for (const [name,data] of Object.entries(JAVA_SOUND_FILES)) check(`OGG header ${name}`,Buffer.from(data,'base64').subarray(0,4).toString()==='OggS');
Audio.setVolume(.4);Audio.setSoundLevels({...DEFAULT_SOUND_LEVELS});Audio.unlockAudio();await flush();
const c=Context.instance;
check('saved master applies before first context',c.gains[0].gain.value===.4);
check('one gain bus per supported Java category',c.gains.length===9);
for(const [i,key] of SOUND_CATEGORIES.entries()) {
  Audio.setSoundLevels({...DEFAULT_SOUND_LEVELS,[key]:.23});check(`${key} has independently controlled gain`,c.gains[i+1].gain.value===.23);
}
Audio.setSoundLevels({...DEFAULT_SOUND_LEVELS,blocks:0});
let start=c.sources.length;Audio.playBreak('stone');Audio.playHurt();await flush();
check('muting blocks does not mute player effects',c.sources.length===start+1 && c.sources.at(-1)?.started);
Audio.setSoundLevels({...DEFAULT_SOUND_LEVELS,hostile:0});start=c.sources.length;Audio.playMob('zombie','hurt');Audio.playMob('cow','hurt');await flush();
check('muting hostile voices preserves friendly creatures',c.sources.length===start+1);
Audio.setSoundLevels({...DEFAULT_SOUND_LEVELS});start=c.sources.length;Audio.playMob('creeper','idle');await flush();check('idle creeper is genuinely silent',c.sources.length===start);
start=c.sources.length;Audio.playMobStep('creeper',undefined,undefined,undefined,'grass');await flush();check('silent creeper still makes original footsteps on grass',c.sources.length===start+1);
// Use a one-variant UI event: repeated plays reuse the same decoded buffer.
const before=c.decodes;Audio.playClick();Audio.playClick();Audio.playClick();await flush();check('decode is shared/cached across concurrent effects',c.decodes<=before+1);
Audio.setListener(0,0,0,0);Audio.playChest(true,8,0,0);await flush();check('positional effect reaches stereo panner',c.pans.at(-1)?.pan.value===1);
Audio.playChest(false,100,0,0);await flush();check('out-of-range effect creates no panner',c.pans.at(-1)?.pan.value===1);
// Rain must be cancellable during lazy decoding and must survive a muted mixer.
Audio.setRain(false);start=c.sources.length;Audio.setRain(true);Audio.setRain(false);await flush();check('stopping rain cancels pending decode/play',c.sources.length===start);
Audio.setVolume(0);Audio.setSoundLevels({...DEFAULT_SOUND_LEVELS,weather:0});Audio.setRain(true);await flush();
const rain=c.sources.at(-1)!;check('muted rain is routed, so unmuting needs no weather toggle',rain.loop && rain.started);
Audio.setVolume(.8);Audio.setSoundLevels({...DEFAULT_SOUND_LEVELS,weather:.3});check('unmuting adjusts the live rain bus',c.gains[0].gain.value===.8 && c.gains[3].gain.value===.3);
Audio.setRain(false);check('rain source stops and disconnects on clear weather',rain.stopped && rain.disconnected);
start=c.sources.length;Audio.playChest(true);Audio.stopWorldAudio();await flush();check('leaving world cancels pending one-shots',c.sources.length===start);
Audio.playBreak('wood');await flush();Audio.stopWorldAudio();check('teardown stops all live world effects',c.sources.every(s=>s.stopped));
c.state='suspended';start=c.sources.length;Audio.playHurt();await flush();check('autoplay gate cannot accumulate stale one-shot bursts',c.sources.length===start);c.state='running';
Audio.setVolume(NaN);check('invalid master cannot poison graph',c.gains[0].gain.value===.5);
for(const [id,instrument] of [[B.AIR,'harp'],[B.STONE,'basedrum'],[B.PLANKS,'bass'],[B.SAND,'snare'],[B.GLASS,'hat'],[B.GOLD_BLOCK,'bell'],[B.CLAY,'flute'],[B.IRON_BLOCK,'iron_xylophone'],[B.SOUL_SAND,'cow_bell'],[B.HAY,'banjo'],[B.WOOL_WHITE,'guitar']] as const) check(`note instrument ${instrument}`,Audio.noteInstrument(id)===instrument);
Audio.playNote(24,B.GOLD_BLOCK);await flush();check('note block includes high F-sharp (pitch 24)',c.sources.at(-1)?.playbackRate.value===2);
Audio.setSoundLevels({...DEFAULT_SOUND_LEVELS,players:0});start=c.sources.length;Audio.playTotem();await flush();
check('totem activation respects the players mixer',c.sources.length===start);
Audio.setSoundLevels({...DEFAULT_SOUND_LEVELS});Audio.playTotem();await flush();
check('totem activation starts its own original sample',c.sources.length===start+1 && c.sources.at(-1)?.started);
check('native totem event resolves to its original recording',RESCUE_SOUND_EVENTS['item.totem.use'][0].name==='item/totem/use_totem');
check('embedded totem recording is a real OGG',Buffer.from(RESCUE_SOUND_FILES['item/totem/use_totem'],'base64').subarray(0,4).toString()==='OggS');
Audio.stopWorldAudio();
console.log(`${checks} audio checks passed`);
