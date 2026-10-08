'use strict';
// PokéKart ses efektleri: hepsi Web Audio API ile anlık üretilir (ses dosyası yok, internet gerekmez).
window.SFX = (function () {
  let ctx = null, master = null;
  let volume = 0.6, muted = false;
  const lastPlayed = {};

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // Tarayıcılar sesi ilk kullanıcı etkileşimine kadar başlatmaz
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, ensure, { capture: true, passive: true }));

  function applyGain() { if (master) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.02); }

  // Tek bir nota: frekans (istersen kaydırarak), zarf ile
  function tone(f, dur, { type = 'sine', vol = 0.3, at = 0, to = null, attack = 0.005, filter = null } = {}) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filter; o.connect(fl); node = fl; }
    node.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  let noiseBuf = null;
  function noise(dur, { vol = 0.3, at = 0, type = 'bandpass', from = 1000, to = null, q = 1, attack = 0.005 } = {}) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime + at;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf;
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  const N = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, D6: 1174.66, E6: 1318.5, G6: 1568, A6: 1760, B6: 1975.5, C7: 2093 };
  function arp(notes, step, opts) { notes.forEach((f, i) => tone(f, opts.dur || 0.25, { ...opts, at: (opts.at || 0) + i * step })); }
  function sparkle(at = 0, n = 6) {
    for (let i = 0; i < n; i++) tone(2500 + Math.random() * 2500, 0.12, { type: 'sine', vol: 0.06, at: at + i * 0.05 + Math.random() * 0.03 });
  }

  const sounds = {
    // paket yırtma: hışırtı + yırtılma
    tear() {
      for (let i = 0; i < 4; i++) noise(0.05, { vol: 0.12, at: i * 0.045, type: 'highpass', from: 2500 + Math.random() * 2000, q: 0.7 });
      noise(0.35, { vol: 0.35, at: 0.18, type: 'bandpass', from: 700, to: 3500, q: 0.8 });
    },
    // üstteki kartı kenara atma
    whoosh() { noise(0.2, { vol: 0.22, type: 'bandpass', from: 2400, to: 500, q: 0.9, attack: 0.03 }); },
    // sıradan kart açılması
    flip() {
      noise(0.04, { vol: 0.18, type: 'highpass', from: 3000 });
      tone(700, 0.06, { type: 'triangle', vol: 0.08, to: 500 });
    },
    // değerli (ama özel olmayan) kart
    rare() { sounds.flip(); tone(N.E6, 0.25, { type: 'triangle', vol: 0.12, at: 0.04 }); tone(N.B6, 0.35, { type: 'triangle', vol: 0.1, at: 0.11 }); },
    // özel kart kapalı geldiğinde: yükselen uğultu
    specialReady() {
      tone(180, 0.7, { type: 'sine', vol: 0.18, to: 360, attack: 0.25 });
      tone(270, 0.7, { type: 'sine', vol: 0.08, to: 540, attack: 0.3 });
      sparkle(0.35, 4);
    },
    // özel kart açılışı (değerli / Pokédex hedefi)
    special() {
      sounds.flip();
      arp([N.C6, N.E6, N.G6, N.C7], 0.07, { type: 'triangle', vol: 0.14, dur: 0.3 });
      sparkle(0.2, 6);
    },
    // Illustration Rare
    illus() {
      sounds.flip();
      arp([N.G5, N.C6, N.E6, N.G6, N.C7], 0.075, { type: 'triangle', vol: 0.15, dur: 0.35 });
      [N.C5, N.E5, N.G5].forEach(f => tone(f, 1.2, { type: 'sine', vol: 0.07, at: 0.35, attack: 0.08 }));
      sparkle(0.25, 10);
    },
    // Special Illustration Rare: fanfar
    sir() {
      sounds.flip();
      const fan = [[N.G5, 0], [N.G5, 0.12], [N.G5, 0.24], [N.C6, 0.38]];
      fan.forEach(([f, at]) => tone(f, at === 0.38 ? 0.9 : 0.12, { type: 'sawtooth', vol: 0.09, at, filter: 2600 }));
      [N.C5, N.E5, N.G5, N.C6].forEach(f => tone(f, 1.4, { type: 'triangle', vol: 0.07, at: 0.38, attack: 0.05 }));
      arp([N.C6, N.E6, N.G6, N.C7, N.E6 * 2], 0.06, { type: 'triangle', vol: 0.1, dur: 0.3, at: 0.5 });
      sparkle(0.4, 14);
    },
    // Pokédex'e yeni hedef eklendi
    target() { arp([N.E6, N.G6, N.E6 * 2], 0.09, { type: 'square', vol: 0.06, dur: 0.18, filter: 3500, at: 0.15 }); },
    // jeton
    coin() { tone(N.B5, 0.08, { type: 'square', vol: 0.07, filter: 4000 }); tone(N.E6, 0.3, { type: 'square', vol: 0.07, at: 0.07, filter: 4000 }); },
    // çok jeton (maaş, toplu satış)
    coins() { for (let i = 0; i < 5; i++) { tone(N.B5, 0.07, { type: 'square', vol: 0.06, at: i * 0.09, filter: 4000 }); tone(N.E6, 0.18, { type: 'square', vol: 0.06, at: i * 0.09 + 0.05, filter: 4000 }); } },
    // seviye atlama
    levelup() { arp([N.C6, N.D6, N.E6, N.G6, N.C7], 0.08, { type: 'square', vol: 0.06, dur: 0.16, filter: 3500 }); tone(N.C7, 0.5, { type: 'triangle', vol: 0.08, at: 0.42 }); },
    // işe gitme
    work() { tone(N.G5, 0.15, { type: 'triangle', vol: 0.12 }); tone(N.C6, 0.25, { type: 'triangle', vol: 0.12, at: 0.13 }); },
    // hata
    error() { tone(150, 0.12, { type: 'square', vol: 0.08, filter: 1200 }); tone(120, 0.18, { type: 'square', vol: 0.08, at: 0.14, filter: 1200 }); },
    // ayarlardaki "dene" butonu
    test() { sounds.coin(); },
  };

  function play(name, delay = 0) {
    if (muted || volume <= 0 || !sounds[name]) return;
    if (delay) return setTimeout(() => play(name), delay);
    const now = performance.now();
    if (now - (lastPlayed[name] || 0) < 70) return;   // aynı ses üst üste binmesin
    lastPlayed[name] = now;
    if (!ensure()) return;
    try { sounds[name](); } catch (e) { /* ses hatası oyunu durdurmasın */ }
  }
  return {
    play,
    setVolume(v) { volume = Math.max(0, Math.min(1, v)); applyGain(); },
    setMuted(m) { muted = !!m; applyGain(); },
  };
})();
