import type {Vehicle} from './driving';

export const defaults={master:.75,music:.65,engine:.38,environment:.35,mute:false};
export type AudioSettings=typeof defaults;
export function preference<T>(key:string,fallback:T):T {
  try {return JSON.parse(localStorage.getItem('saeedau.'+key)??'null')??fallback;}
  catch(error){console.warn('Could not read audio preferences',error);return fallback;}
}
export function savePreference(key:string,value:unknown){
  try {localStorage.setItem('saeedau.'+key,JSON.stringify(value));}
  catch(error){console.warn('Could not save audio preferences',error);}
}
export type Motion={speed:number;throttle:boolean;sand:boolean};

export function createGameAudio(){
  const context=new AudioContext();
  const master=context.createGain();master.gain.value=0;master.connect(context.destination);
  const engine=context.createOscillator(), pulse=context.createOscillator();
  const engineGain=context.createGain(), pulseGain=context.createGain(), filter=context.createBiquadFilter();
  engine.type='triangle';pulse.type='sawtooth';pulseGain.gain.value=.13;filter.frequency.value=245;engineGain.gain.value=0;
  engine.connect(filter);pulse.connect(pulseGain).connect(filter);filter.connect(engineGain).connect(master);
  const wind=context.createBufferSource(), noise=context.createBuffer(1,context.sampleRate*2,context.sampleRate);
  const samples=noise.getChannelData(0);
  let previous=0;
  for(let index=0;index<samples.length;index++){previous=.89*previous+.11*(Math.random()*2-1);samples[index]=previous;}
  const roadFilter=context.createBiquadFilter(), windGain=context.createGain();
  wind.buffer=noise;wind.loop=true;windGain.gain.value=0;wind.connect(roadFilter).connect(windGain).connect(master);
  engine.start();pulse.start();wind.start();
  const set=(parameter:AudioParam,value:number)=>parameter.setTargetAtTime(value,context.currentTime,.12);
  return {
    resume:()=>context.resume(),
    update(settings:AudioSettings,vehicle:Vehicle,motion:Motion,active:boolean){
      const idle={kekro:31,jeep:46,unique:74}[vehicle],speed=Math.min(1,motion.speed/100);
      const frequency=idle*(1+speed*1.65+(motion.throttle?.33:0));
      set(master.gain,active&&!settings.mute?settings.master:0);
      set(engine.frequency,frequency);set(pulse.frequency,frequency*(vehicle==='kekro'?2:3));
      set(filter.frequency,vehicle==='unique'?380:vehicle==='jeep'?260:175);
      set(engineGain.gain,settings.engine*(.09+speed*.07+(motion.throttle?.05:0)));
      set(roadFilter.frequency,motion.sand?560:195+speed*170);
      set(windGain.gain,settings.environment*(.09+speed*(motion.sand?.43:.26)));
    },
    dispose(){engine.stop();pulse.stop();wind.stop();void context.close().catch(error=>console.warn('Could not close game audio',error));},
  };
}
