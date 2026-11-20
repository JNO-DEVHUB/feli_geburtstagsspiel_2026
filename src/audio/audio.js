// Synthetischer Ton ohne Audiodateien (Web Audio), übernommen aus dem Hochzeits-Runner:
// kurze Soundeffekte und kleine eigene Jingles, keine Musik.

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);

export function createAudio() {
  let ctx = null;
  let master;
  let bus;
  let noiseBuf;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return false;
      try {
        ctx = new AC();
      } catch {
        return false;
      }
      master = ctx.createDynamicsCompressor();
      master.threshold.value = -14;
      master.ratio.value = 4;
      master.connect(ctx.destination);
      bus = ctx.createGain();
      bus.gain.value = muted ? 0 : 0.9;
      bus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return true;
  }

  function tone({ f, f2 = f, dur = 0.15, type = 'sine', vol = 0.2, at = 0, attack = 0.005, filter = 0 }) {
    if (!ctx) return;
    const t = ctx.currentTime + at + 0.001;
    const o = ctx.createOscillator();
    const gn = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2 !== f) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol, t + attack);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) {
      const bq = ctx.createBiquadFilter();
      bq.type = 'lowpass';
      bq.frequency.value = filter;
      o.connect(bq);
      node = bq;
    }
    node.connect(gn);
    gn.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise({ dur = 0.08, vol = 0.1, at = 0, hp = 6000 }) {
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(gn);
    gn.connect(bus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  const arp = (base, steps, gap, opts = {}) => steps.forEach((n, i) => tone({ f: NOTE(base + n), dur: 0.22, type: 'triangle', vol: 0.12, at: i * gap, ...opts }));

  const sfx = {
    // Oberfläche
    tap: () => tone({ f: 900, f2: 700, dur: 0.05, type: 'triangle', vol: 0.08 }),
    type: () => tone({ f: 1500 + Math.random() * 300, dur: 0.02, type: 'square', vol: 0.012 }),
    flip: () => noise({ dur: 0.22, vol: 0.07, hp: 1500 }),
    whoosh: () => noise({ dur: 0.3, vol: 0.09, hp: 900 }),
    // Ergebnis
    win: () => arp(72, [0, 4, 7, 12, 7, 12, 16], 0.1, { dur: 0.3 }),
    lose: () => [0, -1, -2, -3].forEach((n, i) => tone({ f: NOTE(58 + n), f2: NOTE(57.5 + n), dur: i === 3 ? 0.7 : 0.28, type: 'sawtooth', vol: 0.11, filter: 900, at: i * 0.3 })),
    fanfare: () => {
      arp(60, [0, 0, 0, 4, 0, 4, 7, 12], 0.13, { type: 'square', vol: 0.08, filter: 2600, dur: 0.24 });
      arp(72, [12, 16, 19, 24], 0.09, { at: 1.1, dur: 0.5 });
    },
    // Bilderrahmen
    klack: () => {
      tone({ f: 180, f2: 90, dur: 0.09, type: 'square', vol: 0.2, filter: 1800 });
      noise({ dur: 0.04, vol: 0.2, hp: 2500 });
    },
    sparkle: () => arp(88, [0, 7, 12, 19], 0.05, { type: 'sine', vol: 0.07, dur: 0.18 }),
    puff: () => {
      noise({ dur: 0.45, vol: 0.2, hp: 500 });
      tone({ f: 300, f2: 60, dur: 0.4, type: 'sine', vol: 0.12 });
    },
    // Spiele
    ping: () => {
      tone({ f: 1318, dur: 0.1, vol: 0.14 });
      tone({ f: 1976, dur: 0.25, vol: 0.12, at: 0.07 });
    },
    no: () => tone({ f: 220, f2: 150, dur: 0.22, type: 'square', vol: 0.12, filter: 1200 }),
    bonk: () => {
      tone({ f: 260, f2: 60, dur: 0.35, type: 'sawtooth', vol: 0.2, filter: 1400 });
      noise({ dur: 0.18, vol: 0.18, hp: 400 });
    },
    mampf: () => {
      tone({ f: 520, f2: 780, dur: 0.07, type: 'triangle', vol: 0.14 });
      tone({ f: 660, f2: 990, dur: 0.09, type: 'triangle', vol: 0.12, at: 0.08 });
    },
    jump: () => tone({ f: 380, f2: 760, dur: 0.16, type: 'triangle', vol: 0.2 }),
    doubleJump: () => {
      tone({ f: 620, f2: 1240, dur: 0.18, type: 'triangle', vol: 0.17 });
      noise({ dur: 0.12, vol: 0.05, hp: 7000 });
    },
    land: () => noise({ dur: 0.05, vol: 0.06, hp: 1200 }),
    hoof: () => tone({ f: 150 + Math.random() * 30, f2: 80, dur: 0.05, type: 'square', vol: 0.05, filter: 900 }),
    wieher: () => {
      for (let i = 0; i < 9; i++) tone({ f: 950 - i * 45 + (i % 2) * 130, dur: 0.06, type: 'sawtooth', vol: 0.07, filter: 2400, at: i * 0.045 });
    },
    slice: (combo = 1) => {
      noise({ dur: 0.09, vol: 0.09, hp: 3500 });
      tone({ f: 700 * 2 ** (Math.min(combo - 1, 10) / 12), f2: 1400, dur: 0.1, type: 'triangle', vol: 0.12 });
    },
    gold: () => arp(84, [0, 4, 7, 12], 0.04, { type: 'sine', vol: 0.1, dur: 0.2 }),
    splat: () => {
      noise({ dur: 0.3, vol: 0.22, hp: 300 });
      tone({ f: 160, f2: 50, dur: 0.3, type: 'sine', vol: 0.2 });
    },
    throw: () => noise({ dur: 0.2, vol: 0.08, hp: 2000 }),
    tor: () => {
      noise({ dur: 0.5, vol: 0.12, hp: 1500 });
      arp(67, [0, 4, 7, 12], 0.08, { dur: 0.3 });
    },
    save: () => {
      tone({ f: 200, f2: 120, dur: 0.12, type: 'square', vol: 0.16, filter: 1200 });
      tone({ f: 330, f2: 247, dur: 0.4, type: 'triangle', vol: 0.1, at: 0.15 });
    },
    whistle: () => {
      for (let i = 0; i < 6; i++) tone({ f: i % 2 ? 2350 : 2500, dur: 0.05, type: 'square', vol: 0.05, filter: 5000, at: i * 0.045 });
    },
    bead: (i = 0) => tone({ f: NOTE(76 + (i % 5) * 2), dur: 0.08, type: 'sine', vol: 0.12 }),
    reveal: (i = 0) => tone({ f: NOTE(64 + i * 2), dur: 0.14, type: 'triangle', vol: 0.12 }),
    meow: () => {
      tone({ f: 620, f2: 880, dur: 0.14, type: 'sawtooth', vol: 0.08, filter: 2200 });
      tone({ f: 880, f2: 520, dur: 0.25, type: 'sawtooth', vol: 0.08, filter: 2000, at: 0.13 });
    },
    hiss: () => noise({ dur: 0.45, vol: 0.14, hp: 4500 }),
    mark: () => tone({ f: 500, dur: 0.04, type: 'square', vol: 0.05, filter: 2000 }),
    tick: () => tone({ f: 1000, dur: 0.03, type: 'square', vol: 0.05 }),
    // Finale
    fuse: () => noise({ dur: 0.9, vol: 0.05, hp: 6000 }),
    count: () => tone({ f: 660, dur: 0.14, type: 'square', vol: 0.1, filter: 2400 }),
    boom: () => {
      noise({ dur: 1.1, vol: 0.4, hp: 80 });
      tone({ f: 120, f2: 30, dur: 0.9, type: 'sine', vol: 0.4 });
    },
    crumple: () => {
      for (let i = 0; i < 5; i++) noise({ dur: 0.05, vol: 0.1, hp: 2500, at: i * 0.05 });
    },
    drum: () => {
      for (let i = 0; i < 14; i++) noise({ dur: 0.04, vol: 0.05 + i * 0.006, hp: 1200, at: i * 0.055 });
    },
  };

  return {
    unlock: ensure,
    play(name, arg) {
      if (muted || !ensure()) return;
      sfx[name]?.(arg);
    },
    get muted() {
      return muted;
    },
    setMuted(on) {
      muted = !!on;
      if (bus) bus.gain.value = muted ? 0 : 0.9;
    },
    suspend() {
      if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
    },
    resume() {
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
  };
}
