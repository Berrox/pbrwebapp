// Audio-Bausteine der Effekte (Web Audio). Jeder Baustein hat input/output, update(), stop() (Rauschen, Schwingungen) und tail().
import { chorusAudio, distortionAudio, echoAudio, filterAudio, lofiAudio, radioAudio, tapeAudio, vinylAudio, type EffectProfile, type Kind } from "../model/effects";

export interface Res { ctx: AudioContext; feed: AudioNode; noise: AudioBuffer; crackle: AudioBuffer }
export interface FxModule { input: AudioNode; output: AudioNode; nodes: AudioNode[]; update(p: EffectProfile, immediate: boolean): void; stop(): void; tail(p: EffectProfile): number }
type Build = (r: Res) => FxModule;

const SAT_CURVE = (() => { const c = new Float32Array(1024); for (let i = 0; i < c.length; i++) c[i] = Math.tanh(3 * ((i / (c.length - 1)) * 2 - 1)) / Math.tanh(3); return c; })();
const DIST_CURVE = (() => { const c = new Float32Array(1024); for (let i = 0; i < c.length; i++) c[i] = Math.tanh(4 * ((i / (c.length - 1)) * 2 - 1)) / Math.tanh(4); return c; })();
/** Treppenkurve für die Bit-Reduktion: bits Bit Tiefe ergibt 2^bits + 1 verschiedene Werte. */
export function quantCurve(bits: number, n = 4096): Float32Array {
  const half = Math.pow(2, bits - 1), c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = Math.max(-1, Math.min(1, Math.round(((i / (n - 1)) * 2 - 1) * half) / half));
  return c;
}
const setter = (ctx: AudioContext, immediate: boolean) => {
  const now = ctx.currentTime;
  return (param: AudioParam, v: number) => {
    if (immediate) param.value = v;
    else { param.cancelScheduledValues(now); param.setTargetAtTime(v, now, 0.03); } // weich, ohne Knacken
  };
};

/** Sammelt die Knoten eines Bausteins, damit sie gemeinsam beendet und getrennt werden können. */
class Kit {
  nodes: AudioNode[] = [];
  srcs: AudioScheduledSourceNode[] = [];
  readonly r: Res;
  constructor(r: Res) { this.r = r; }
  add<T extends AudioNode>(n: T): T { this.nodes.push(n); return n; }
  gain(v = 1): GainNode { const g = this.add(this.r.ctx.createGain()); g.gain.value = v; return g; }
  filter(type: BiquadFilterType, hz: number, q = 0.7): BiquadFilterNode {
    const f = this.add(this.r.ctx.createBiquadFilter()); f.type = type; f.frequency.value = hz; f.Q.value = q; return f;
  }
  delay(max: number, t: number): DelayNode { const d = this.add(this.r.ctx.createDelay(max)); d.delayTime.value = t; return d; }
  /** Schwingung, die einen Parameter bewegt (z. B. Verzögerungszeit = Tonhöhenschwankung). depth = Stärke. */
  lfo(hz: number, target: AudioParam): { depth: GainNode; osc: OscillatorNode } {
    const osc = this.r.ctx.createOscillator(); osc.frequency.value = hz;
    const depth = this.gain(0); osc.connect(depth); depth.connect(target); osc.start(); this.srcs.push(osc);
    return { depth, osc };
  }
  /** Endlos laufende Quelle (Rauschen, Knistern), speist die Pad-Lautstärke. Rückgabe: Pegel. */
  loop(buf: AudioBuffer): GainNode {
    const s = this.r.ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    const g = this.gain(0); s.connect(g); g.connect(this.r.feed);
    s.start(0, Number.isFinite(buf.duration) ? Math.random() * buf.duration : 0); this.srcs.push(s);
    return g;
  }
  stop(): void { for (const s of this.srcs) { try { s.stop(); } catch { /* schon beendet */ } } }
  done(m: Omit<FxModule, "nodes" | "stop">): FxModule { return { ...m, nodes: [...this.nodes, ...this.srcs], stop: () => this.stop() }; }
}

const tape: Build = (r) => {
  const k = new Kit(r), lp = k.filter("lowpass", 20000), dry = k.gain(), wet = k.gain(0), sat = k.gain();
  const shaper = k.add(r.ctx.createWaveShaper()); shaper.curve = SAT_CURVE; shaper.oversample = "2x";
  const delay = k.delay(0.05, 0.01);
  const wow1 = k.lfo(0.43, delay.delayTime), wow2 = k.lfo(0.71, delay.delayTime), flut = k.lfo(6.7, delay.delayTime); // zwei langsame, unregelmäßige Anteile + Flutter
  const noise = k.loop(r.noise), clicks = k.loop(r.crackle);
  lp.connect(dry); lp.connect(shaper); shaper.connect(wet); dry.connect(sat); wet.connect(sat); sat.connect(delay);
  return k.done({ input: lp, output: delay, tail: () => 0, update(p, imm) {
    const t = tapeAudio(p.tape), s = setter(r.ctx, imm);
    s(lp.frequency, t.lowpassHz); s(dry.gain, 1 - t.satWet); s(wet.gain, t.satWet);
    s(wow1.depth.gain, t.wowDepth * 0.6); s(wow2.depth.gain, t.wowDepth * 0.4); s(flut.depth.gain, t.flutterDepth);
    s(noise.gain, t.noiseGain); s(clicks.gain, t.clickGain);
  } });
};
const vinyl: Build = (r) => {
  const k = new Kit(r), lp = k.filter("lowpass", 20000), delay = k.delay(0.05, 0.01);
  const wob = k.lfo(0.555, delay.delayTime); // 33 Umdrehungen pro Minute
  const noise = k.loop(r.noise), crackle = k.loop(r.crackle);
  lp.connect(delay);
  return k.done({ input: lp, output: delay, tail: () => 0, update(p, imm) {
    const t = vinylAudio(p.vinyl), s = setter(r.ctx, imm);
    s(lp.frequency, t.lowpassHz); s(wob.depth.gain, t.wobbleDepth); s(noise.gain, t.noiseGain); s(crackle.gain, t.crackleGain);
  } });
};
const radio: Build = (r) => {
  const k = new Kit(r), hp = k.filter("highpass", 20), lp = k.filter("lowpass", 20000), mid = k.filter("peaking", 1500, 0.9), mono = k.gain();
  mono.channelCountMode = "explicit"; mono.channelInterpretation = "speakers";
  hp.connect(lp); lp.connect(mid); mid.connect(mono);
  return k.done({ input: hp, output: mono, tail: () => 0, update(p, imm) {
    const t = radioAudio(p.radio), s = setter(r.ctx, imm);
    s(hp.frequency, t.hpHz); s(lp.frequency, t.lpHz); s(mid.gain, t.midDb); mono.channelCount = t.mono ? 1 : 2;
  } });
};
const filter: Build = (r) => {
  const k = new Kit(r), hp = k.filter("highpass", 20), lp = k.filter("lowpass", 20000);
  hp.connect(lp);
  return k.done({ input: hp, output: lp, tail: () => 0, update(p, imm) {
    const t = filterAudio(p.filter), s = setter(r.ctx, imm);
    s(hp.frequency, t.hpHz); s(lp.frequency, t.lpHz);
  } });
};
const distortion: Build = (r) => {
  const k = new Kit(r), inp = k.gain(), dry = k.gain(), pre = k.gain(), tone = k.filter("lowpass", 20000), post = k.gain(0), out = k.gain();
  const shaper = k.add(r.ctx.createWaveShaper()); shaper.curve = DIST_CURVE;
  inp.connect(dry); dry.connect(out); inp.connect(pre); pre.connect(shaper); shaper.connect(tone); tone.connect(post); post.connect(out);
  return k.done({ input: inp, output: out, tail: () => 0, update(p, imm) {
    const t = distortionAudio(p.distortion), s = setter(r.ctx, imm);
    s(pre.gain, t.drive); s(tone.frequency, t.toneHz); s(post.gain, t.wet * t.post); s(dry.gain, 1 - t.wet);
  } });
};
const chorus: Build = (r) => {
  const k = new Kit(r), inp = k.gain(), dry = k.gain(), wet = k.gain(0), out = k.gain(), delay = k.delay(0.05, 0.02);
  const mod = k.lfo(0.8, delay.delayTime);
  inp.connect(dry); dry.connect(out); inp.connect(delay); delay.connect(wet); wet.connect(out);
  return k.done({ input: inp, output: out, tail: () => 0, update(p, imm) {
    const t = chorusAudio(p.chorus), s = setter(r.ctx, imm);
    s(mod.osc.frequency, t.rateHz); s(mod.depth.gain, t.depth); s(wet.gain, t.wet); s(dry.gain, 1 - 0.4 * t.wet);
  } });
};
const lofi: Build = (r) => {
  const k = new Kit(r), inp = k.gain(), dry = k.gain(), wet = k.gain(0), tone = k.filter("lowpass", 20000), out = k.gain();
  const shaper = k.add(r.ctx.createWaveShaper());
  let bits = 16;
  inp.connect(dry); dry.connect(out); inp.connect(shaper); shaper.connect(tone); tone.connect(wet); wet.connect(out);
  return k.done({ input: inp, output: out, tail: () => 0, update(p, imm) {
    const t = lofiAudio(p.lofi), s = setter(r.ctx, imm);
    if (t.bits !== bits) { bits = t.bits; shaper.curve = t.bits >= 16 ? null : quantCurve(t.bits); } // Kurve nur bei geänderter Bit-Tiefe tauschen
    s(tone.frequency, t.toneHz); s(wet.gain, t.wet); s(dry.gain, 1 - t.wet);
  } });
};
const echo: Build = (r) => {
  const k = new Kit(r), inp = k.gain(), dry = k.gain(), wet = k.gain(0), fb = k.gain(0), out = k.gain(), delay = k.delay(1.5, 0.3);
  inp.connect(dry); dry.connect(out); inp.connect(delay); delay.connect(wet); wet.connect(out); delay.connect(fb); fb.connect(delay);
  return k.done({
    input: inp, output: out,
    tail(p) { // Wie lange das Echo nach dem Ende des Pads noch hörbar ist (Sekunden, höchstens 6)
      const t = echoAudio(p.echo);
      if (!p.echo.on || t.wet <= 0) return 0;
      const n = t.feedback > 0 ? Math.min(12, Math.ceil(Math.log(0.01) / Math.log(t.feedback))) : 1;
      return Math.min(6, t.timeSec * (n + 1));
    },
    update(p, imm) {
      const t = echoAudio(p.echo), s = setter(r.ctx, imm);
      s(delay.delayTime, t.timeSec); s(fb.gain, t.feedback); s(wet.gain, t.wet);
    },
  });
};
export const BUILDERS: Record<Kind, Build> = { tape, vinyl, radio, filter, distortion, chorus, lofi, echo };
