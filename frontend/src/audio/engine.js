// Generative "rooms" for the writing playlist.
//
// Everything here is original and synthesised live with the Web Audio API: chord
// progressions, bass lines, drums, melodies and ambience. No samples, no licensing,
// nothing to download. Each room is a small step sequencer (16 steps per bar) plus
// optional looping noise beds (rain, wind, rumble...).
//
//   const room = createRoom(ctx, 'lofi', destinationNode);
//   room.schedule(ctx.currentTime + 3);   // call every ~250 ms to queue upcoming notes
//   room.stop();                          // fade out and release everything

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (arr, r) => arr[Math.floor(r() * arr.length)];

function noiseBuffer(ctx, kind, seconds = 3) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    if (kind === 'brown') {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

function impulse(ctx, seconds, decay = 2.5) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c += 1) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
    }
  }
  return buffer;
}

function env(gainParam, t, attack, peak, decay) {
  gainParam.setValueAtTime(0.0001, t);
  gainParam.linearRampToValueAtTime(peak, t + attack);
  gainParam.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

// ---- instruments -------------------------------------------------------------

function makeKit(ctx, bus, rand, reverbSeconds) {
  const loops = [];
  const noises = { white: noiseBuffer(ctx, 'white'), brown: noiseBuffer(ctx, 'brown') };

  const verb = ctx.createConvolver();
  verb.buffer = impulse(ctx, reverbSeconds);
  const verbIn = ctx.createGain();
  const verbOut = ctx.createGain();
  verbOut.gain.value = 0.9;
  verbIn.connect(verb).connect(verbOut).connect(bus);

  const wetSend = (node, amount) => {
    if (!amount) return;
    const s = ctx.createGain();
    s.gain.value = amount;
    node.connect(s).connect(verbIn);
  };

  function voice({ freq, t, a = 0.01, d = 1, gain = 0.2, type = 'sine', cutoff = 5000, detune = 0, wet = 0.25 }) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.detune.value = detune;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    env(g.gain, t, a, gain, d);
    o.connect(f).connect(g).connect(bus);
    wetSend(g, wet);
    o.start(t);
    o.stop(t + a + d + 0.05);
  }

  function burst({ t, type = 'bandpass', freq = 2000, q = 1, a = 0.002, d = 0.1, gain = 0.1, wet = 0, kind = 'white' }) {
    const src = ctx.createBufferSource();
    src.buffer = noises[kind];
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    env(g.gain, t, a, gain, d);
    src.connect(f).connect(g).connect(bus);
    wetSend(g, wet);
    src.start(t, Math.random() * 2);
    src.stop(t + a + d + 0.05);
  }

  function loopNoise({ kind = 'white', filters = [], gain = 0.1, lfo }) {
    const src = ctx.createBufferSource();
    src.buffer = noises[kind];
    src.loop = true;
    let node = src;
    filters.forEach(({ type, freq, q = 0.7 }) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      node.connect(f);
      node = f;
    });
    const g = ctx.createGain();
    g.gain.value = gain;
    node.connect(g).connect(bus);
    src.start(0, Math.random() * 2);
    loops.push(src);
    if (lfo) {
      const o = ctx.createOscillator();
      o.frequency.value = lfo.rate;
      const depth = ctx.createGain();
      depth.gain.value = lfo.depth;
      o.connect(depth).connect(g.gain);
      o.start();
      loops.push(o);
    }
  }

  return {
    rand,
    loopNoise,
    voice,
    burst,
    stopLoops: () => loops.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }),

    rhodes(freq, t, d = 2, vel = 0.7) {
      voice({ freq, t, d, gain: vel * 0.16, cutoff: 3200, wet: 0.3 });
      voice({ freq, t, d, gain: vel * 0.1, detune: 7, cutoff: 3200, wet: 0.3 });
      voice({ freq: freq * 2, t, d: d * 0.45, gain: vel * 0.05, cutoff: 4500, wet: 0.3 });
      voice({ freq: freq * 7, t, a: 0.003, d: 0.18, gain: vel * 0.012, wet: 0.2 });
    },
    piano(freq, t, d = 2.5, vel = 0.7) {
      voice({ freq, t, a: 0.004, d, gain: vel * 0.2, type: 'triangle', cutoff: 1800 + vel * 2200, wet: 0.35 });
      voice({ freq: freq * 2, t, a: 0.004, d: d * 0.55, gain: vel * 0.06, cutoff: 5000, wet: 0.35 });
      voice({ freq: freq * 3, t, a: 0.003, d: d * 0.3, gain: vel * 0.025, cutoff: 6000, wet: 0.35 });
    },
    pad(freq, t, len = 8, vel = 0.5) {
      [-9, 0, 9].forEach((detune) =>
        voice({ freq, t, a: len * 0.4, d: len * 0.75, gain: vel * 0.05, type: 'sawtooth', cutoff: 650, detune, wet: 0.5 })
      );
    },
    bass(freq, t, d = 0.5, vel = 0.7) {
      voice({ freq, t, a: 0.012, d, gain: vel * 0.32, cutoff: 450, wet: 0 });
      voice({ freq: freq * 2, t, a: 0.012, d: d * 0.5, gain: vel * 0.05, type: 'triangle', cutoff: 700, wet: 0 });
    },
    kick(t, vel = 0.8) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      const g = ctx.createGain();
      env(g.gain, t, 0.002, vel * 0.55, 0.3);
      o.connect(g).connect(bus);
      o.start(t);
      o.stop(t + 0.4);
    },
    snare(t, vel = 0.7) {
      burst({ t, freq: 1900, q: 0.8, d: 0.16, gain: vel * 0.13, wet: 0.15 });
      voice({ freq: 185, t, a: 0.002, d: 0.08, gain: vel * 0.07, type: 'triangle', wet: 0 });
    },
    hat(t, vel = 0.5, open = false) {
      burst({ t, type: 'highpass', freq: 7500, q: 0.5, d: open ? 0.14 : 0.035, gain: vel * 0.045 });
    },
    brush(t, vel = 0.5) {
      burst({ t, type: 'bandpass', freq: 3200, q: 0.5, a: 0.04, d: 0.16, gain: vel * 0.05 });
    },
    click(t, vel = 0.5, freq = 1500) {
      burst({ t, freq, q: 1.2, a: 0.001, d: 0.035, gain: vel * 0.09 });
    },
    thump(t, vel = 0.5) {
      voice({ freq: 62, t, a: 0.004, d: 0.14, gain: vel * 0.2, wet: 0 });
    },
    chirp(t, base, count = 3, vel = 0.5) {
      for (let k = 0; k < count; k += 1) {
        const t0 = t + k * 0.11;
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(base * (1 + k * 0.03), t0);
        o.frequency.exponentialRampToValueAtTime(base * 1.4, t0 + 0.07);
        const g = ctx.createGain();
        env(g.gain, t0, 0.008, vel * 0.03, 0.07);
        o.connect(g).connect(bus);
        wetSend(g, 0.5);
        o.start(t0);
        o.stop(t0 + 0.12);
      }
    },
    thunder(t) {
      burst({ t, type: 'lowpass', freq: 130, q: 0.5, a: 1.6, d: 4.5, gain: 0.5, kind: 'brown', wet: 0.3 });
    },
  };
}

// ---- rooms ---------------------------------------------------------------------

const ROOMS = {
  // Warm lo-fi hip-hop: ii–V–I–vi on electric piano, soft drums, vinyl crackle.
  lofi: {
    bpm: 76,
    swing: 0.14,
    reverb: 2.2,
    level: 1.0,
    chords: [
      { notes: [53, 57, 60, 64], root: 38 }, // Dm9
      { notes: [53, 59, 62, 64], root: 43 }, // G13
      { notes: [52, 59, 62, 67], root: 36 }, // Cmaj9
      { notes: [55, 59, 60, 64], root: 45 }, // Am9
    ],
    scale: [72, 74, 76, 79, 81, 84],
    ambient(k) {
      k.loopNoise({ filters: [{ type: 'highpass', freq: 4500 }], gain: 0.0045 });
    },
    onStep(i, t, k, st) {
      const r = k.rand;
      const bar = Math.floor(i / 16);
      const s = i % 16;
      const chord = this.chords[bar % 4];
      if (s === 0) chord.notes.forEach((n, j) => k.rhodes(midi(n), t + j * 0.018, 2.4, 0.75));
      if (s === 10 && r() < 0.8) chord.notes.forEach((n, j) => k.rhodes(midi(n), t + j * 0.012, 0.9, 0.45));
      if (s === 0) k.bass(midi(chord.root), t, 0.9, 0.9);
      if (s === 6 && r() < 0.6) k.bass(midi(chord.root + 7), t, 0.4, 0.6);
      if (s === 10) k.bass(midi(chord.root), t, 0.5, 0.75);
      if (s === 14 && r() < 0.4) k.bass(midi(chord.root + 2), t, 0.3, 0.5);
      if (s === 0 || s === 10 || (s === 7 && r() < 0.5)) k.kick(t, 0.85);
      if (s === 4 || s === 12) k.snare(t, s === 12 ? 0.8 : 0.65);
      if (s % 2 === 0) k.hat(t, s % 4 === 0 ? 0.65 : 0.35 + r() * 0.2);
      if (s === 14 && r() < 0.4) k.hat(t, 0.5, true);
      if (s % 2 === 0 && r() < 0.2) {
        st.mel = Math.max(0, Math.min(this.scale.length - 1, (st.mel ?? 2) + pick([-2, -1, 1, 2], r)));
        k.rhodes(midi(this.scale[st.mel]), t, 1.1, 0.4);
      }
      if (r() < 0.1) k.click(t + r() * 0.15, 0.25, 2500 + r() * 2500);
    },
  },

  // Rain on glass: slow pads, sparse piano, occasional distant thunder.
  rain: {
    bpm: 60,
    reverb: 3.2,
    level: 0.8,
    chords: [
      [45, 57, 60, 64, 71], // Am9
      [41, 53, 57, 60, 64], // Fmaj7
      [48, 55, 59, 64, 67], // Cmaj7
      [43, 55, 59, 62, 64], // G6
    ],
    scale: [69, 72, 74, 76, 79, 81],
    ambient(k) {
      k.loopNoise({ filters: [{ type: 'highpass', freq: 900 }, { type: 'lowpass', freq: 9000 }], gain: 0.12, lfo: { rate: 0.11, depth: 0.03 } });
      k.loopNoise({ kind: 'brown', filters: [{ type: 'lowpass', freq: 320 }], gain: 0.22, lfo: { rate: 0.07, depth: 0.05 } });
      k.loopNoise({ filters: [{ type: 'bandpass', freq: 3200, q: 0.9 }], gain: 0.03, lfo: { rate: 0.3, depth: 0.015 } });
    },
    onStep(i, t, k) {
      const r = k.rand;
      if (i % 32 === 0) this.chords[(i / 32) % 4].forEach((n, j) => k.pad(midi(n), t + j * 0.3, 10, 0.55));
      if (r() < (i % 2 === 0 ? 0.09 : 0.015)) k.piano(midi(pick(this.scale, r)), t, 3.2, 0.3 + r() * 0.2);
      if (i % 64 === 40 && r() < 0.35) k.thunder(t);
    },
  },

  // Late-night café: brushed jazz trio with a walking bass, murmur and cup clinks.
  cafe: {
    bpm: 84,
    swing: 0.22,
    reverb: 1.6,
    level: 1.5,
    chords: [
      { notes: [53, 57, 60, 64], root: 38, third: 3 }, // Dm7
      { notes: [53, 55, 59, 62], root: 43, third: 4 }, // G7
      { notes: [52, 55, 59, 64], root: 36, third: 4 }, // Cmaj7
      { notes: [55, 57, 61, 64], root: 45, third: 4 }, // A7
    ],
    ambient(k) {
      k.loopNoise({ filters: [{ type: 'bandpass', freq: 700, q: 0.6 }], gain: 0.035, lfo: { rate: 0.3, depth: 0.015 } });
      k.loopNoise({ filters: [{ type: 'bandpass', freq: 1500, q: 0.8 }], gain: 0.015, lfo: { rate: 0.17, depth: 0.01 } });
    },
    onStep(i, t, k) {
      const r = k.rand;
      const bar = Math.floor(i / 16);
      const s = i % 16;
      const chord = this.chords[bar % 4];
      const next = this.chords[(bar + 1) % 4];
      if (s % 4 === 0) {
        const approach = next.root > chord.root ? next.root - 1 : next.root + 1;
        const line = [chord.root, chord.root + chord.third, chord.root + 7, approach];
        k.bass(midi(line[s / 4]), t, 0.42, s === 0 ? 0.9 : 0.7);
      }
      if ((s === 0 && r() < 0.9) || (s === 6 && r() < 0.6) || (s === 10 && r() < 0.5)) {
        chord.notes.forEach((n, j) => k.piano(midi(n), t + j * 0.014, 1.1, 0.34));
      }
      if ([0, 4, 6, 8, 12, 14].includes(s)) k.hat(t, 0.35 + r() * 0.15, s === 6 || s === 14);
      if (s === 4 || s === 12) k.brush(t, 0.55);
      if (r() < 0.012) k.voice({ freq: 2400 + r() * 1400, t, d: 0.18, gain: 0.04, wet: 0.35 });
    },
  },

  // Early trail: wind, birdsong and slow open chords with soft plucks.
  forest: {
    bpm: 48,
    reverb: 3.5,
    level: 1.9,
    chords: [
      [50, 57, 62, 66], // D
      [47, 54, 59, 62, 66], // Bm7
      [43, 55, 59, 62, 67], // G
      [45, 52, 61, 64, 69], // A
    ],
    scale: [74, 76, 78, 81, 83, 86],
    ambient(k) {
      k.loopNoise({ filters: [{ type: 'bandpass', freq: 500, q: 0.7 }], gain: 0.05, lfo: { rate: 0.07, depth: 0.035 } });
      k.loopNoise({ filters: [{ type: 'highpass', freq: 3200 }], gain: 0.012, lfo: { rate: 0.2, depth: 0.008 } });
    },
    onStep(i, t, k) {
      const r = k.rand;
      if (i % 32 === 0) this.chords[(i / 32) % 4].forEach((n, j) => k.pad(midi(n), t + j * 0.4, 11, 0.5));
      if (r() < 0.05) k.chirp(t, 2600 + r() * 2200, 2 + Math.floor(r() * 3), 0.5 + r() * 0.5);
      if (i % 2 === 0 && r() < 0.08) k.piano(midi(pick(this.scale, r)), t, 1.4, 0.35);
    },
  },

  // Unfinished prelude: solo piano arpeggios in A minor with a slow melody on top.
  piano: {
    bpm: 62,
    reverb: 3.8,
    level: 1.55,
    chords: [
      { notes: [57, 60, 64, 69], root: 45 }, // Am
      { notes: [53, 60, 65, 69], root: 41 }, // F
      { notes: [55, 60, 64, 67], root: 36 }, // C
      { notes: [55, 59, 62, 67], root: 43 }, // G
    ],
    melody: [76, 74, 72, 71, 69, 72, 74, 76],
    onStep(i, t, k, st) {
      const r = k.rand;
      const bar = Math.floor(i / 16);
      const s = i % 16;
      const chord = this.chords[bar % 4];
      const human = (r() - 0.5) * 0.03;
      if (s === 0) k.piano(midi(chord.root), t, 3.8, 0.7);
      if (s % 2 === 0 && r() > 0.1) {
        const order = [0, 1, 2, 3, 2, 1, 2, 3];
        k.piano(midi(chord.notes[order[s / 2]]), t + human, 2.2, 0.32 + r() * 0.18);
      }
      if (s === 0 && bar % 2 === 0) {
        st.m = ((st.m ?? -1) + 1) % this.melody.length;
        k.piano(midi(this.melody[st.m]), t + 0.02, 4, 0.55);
      }
    },
  },

  // Night express: steady rail clacks, low rumble, slow pads and a distant horn.
  train: {
    bpm: 96,
    reverb: 2.4,
    level: 0.97,
    chords: [
      [50, 57, 62], // Dm
      [46, 53, 58, 62], // Bb
      [53, 57, 60, 65], // F
      [48, 55, 60, 64], // C
    ],
    scale: [74, 77, 79, 81, 84],
    ambient(k) {
      k.loopNoise({ kind: 'brown', filters: [{ type: 'lowpass', freq: 170 }], gain: 0.32, lfo: { rate: 0.09, depth: 0.05 } });
      k.loopNoise({ filters: [{ type: 'bandpass', freq: 800, q: 0.8 }], gain: 0.018, lfo: { rate: 0.4, depth: 0.008 } });
    },
    onStep(i, t, k) {
      const r = k.rand;
      const s = i % 16;
      if (s === 0 || s === 3 || s === 8 || s === 11) {
        const accent = s === 0 ? 1 : 0.7;
        k.click(t, accent, 1400 + r() * 300);
        k.thump(t, accent * 0.8);
      }
      if (i % 64 === 0) this.chords[(i / 64) % 4].forEach((n, j) => k.pad(midi(n), t + j * 0.25, 7, 0.5));
      if (i % 2 === 0 && r() < 0.045) k.piano(midi(pick(this.scale, r)), t, 1.6, 0.28);
      if (i % 384 === 128 && r() < 0.7) {
        k.voice({ freq: 220, t, type: 'sawtooth', cutoff: 520, a: 0.5, d: 2.2, gain: 0.05, wet: 0.45 });
        k.voice({ freq: 277, t, type: 'sawtooth', cutoff: 520, a: 0.5, d: 2.2, gain: 0.04, wet: 0.45 });
      }
    },
  },
};

export const ROOM_IDS = Object.keys(ROOMS);

export function createRoom(ctx, id, destination, { seed = Date.now() } = {}) {
  const spec = ROOMS[id] || ROOMS.lofi;
  const bus = ctx.createGain();
  bus.gain.value = spec.level ?? 1;
  bus.connect(destination);

  const kit = makeKit(ctx, bus, rng(seed), spec.reverb ?? 2.5);
  spec.ambient?.(kit);

  const stepDur = 60 / spec.bpm / 4;
  const state = { time: null, step: 0 };
  const scratch = {};
  let stopped = false;

  return {
    schedule(until) {
      if (stopped) return;
      if (state.time === null) state.time = ctx.currentTime + 0.12;
      while (state.time < until) {
        const swing = state.step % 2 === 1 ? (spec.swing ?? 0) * stepDur : 0;
        spec.onStep(state.step, state.time + swing, kit, scratch);
        state.time += stepDur;
        state.step += 1;
      }
    },
    stop() {
      if (stopped) return;
      stopped = true;
      const now = ctx.currentTime;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setTargetAtTime(0, now, 0.08);
      setTimeout(() => {
        kit.stopLoops();
        try { bus.disconnect(); } catch { /* already disconnected */ }
      }, 600);
    },
  };
}
