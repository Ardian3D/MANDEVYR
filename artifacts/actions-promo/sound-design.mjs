// Original deterministic sound bed; no stock recordings or additional generation credits.
import { writeFile } from 'node:fs/promises';
const rate=44100,duration=40,frames=rate*duration,data=Buffer.alloc(44+frames*4);
data.write('RIFF',0);data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(2,22);data.writeUInt32LE(rate,24);data.writeUInt32LE(rate*4,28);data.writeUInt16LE(4,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(frames*4,40);
const notes=[164.8138,207.6523,246.9417,329.6276];
const clicks=[11.35,14.25,20.05],sweeps=[2.8,8.9,12.55,15.9,19,22.6,34.7];
let seed=1337;
for(let i=0;i<frames;i++){
 const t=i/rate,fade=Math.min(1,t/1.5,(40-t)/2),drift=.68+.14*Math.sin(t*.31);
 let left=0,right=0;
 for(let j=0;j<notes.length;j++){const amp=.016*(1+.12*Math.sin(t*.4+j));left+=Math.sin(2*Math.PI*notes[j]*t+.2*Math.sin(t*.19+j))*amp;right+=Math.sin(2*Math.PI*(notes[j]+.06)*t+.2*Math.sin(t*.17+j))*amp}
 const beat=t%(.75),pulse=Math.exp(-beat*15)*Math.sin(2*Math.PI*82.4069*t)*.011;
 seed=(seed*1664525+1013904223)>>>0;const noise=((seed>>>8)/16777216-.5)*2;
 let fx=0;
 for(const at of clicks){const d=t-at;if(d>=0&&d<.18)fx+=Math.exp(-d*44)*(Math.sin(2*Math.PI*1175*d)*.035+noise*.015)}
 for(const at of sweeps){const d=t-at;if(d>=0&&d<.85)fx+=Math.sin(Math.PI*d/.85)**2*noise*.013}
 const chime=t-35.5;if(chime>=0){fx+=(Math.sin(2*Math.PI*659.255*chime)+.3*Math.sin(2*Math.PI*1318.51*chime))*Math.exp(-chime*1.4)*.027}
 left=(left*drift+pulse+fx)*fade;right=(right*drift+pulse+fx*.9)*fade;
 data.writeInt16LE(Math.round(Math.max(-1,Math.min(1,left))*32767),44+i*4);data.writeInt16LE(Math.round(Math.max(-1,Math.min(1,right))*32767),46+i*4);
}
await writeFile(new URL('assets/sound-bed.wav',import.meta.url),data);
console.log('Original 40-second stereo sound bed written.');
