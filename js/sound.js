/*
 * sound.js — Efek suara (dibuat langsung dengan Web Audio API, tanpa file audio)
 */
(function (global) {
  'use strict';
  var ctx = null;
  var enabled = true;

  function audio() {
    if (!ctx) {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, type, gain, slideTo) {
    var a = audio();
    if (!a) return;
    var t0 = a.currentTime + start;
    var osc = a.createOscillator(), g = a.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.25, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(a.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  function noise(start, dur, gain) {
    var a = audio();
    if (!a) return;
    var len = Math.floor(a.sampleRate * dur);
    var buf = a.createBuffer(1, len, a.sampleRate), data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    var src = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1800;
    src.buffer = buf; g.gain.value = gain || 0.35;
    src.connect(f); f.connect(g); g.connect(a.destination);
    src.start(a.currentTime + start);
  }

  var Sound = {
    setEnabled: function (on) { enabled = !!on; },
    isEnabled: function () { return enabled; },
    /** Panggil dari interaksi pengguna pertama agar browser HP mengizinkan audio. */
    unlock: function () { if (enabled) audio(); },
    play: function (kind) {
      if (!enabled) return;
      try {
        switch (kind) {
          case 'move': noise(0, 0.06, 0.45); tone(420, 0, 0.07, 'triangle', 0.18, 300); break;
          case 'capture': noise(0, 0.12, 0.7); tone(220, 0, 0.14, 'square', 0.12, 120); break;
          case 'check': tone(880, 0, 0.12, 'triangle', 0.22); tone(1175, 0.11, 0.18, 'triangle', 0.22); break;
          case 'castle': noise(0, 0.05, 0.4); noise(0.09, 0.05, 0.4); break;
          case 'promote': tone(660, 0, 0.1, 'sine', 0.2); tone(880, 0.09, 0.1, 'sine', 0.2); tone(1320, 0.18, 0.18, 'sine', 0.2); break;
          case 'end': tone(523, 0, 0.18, 'sine', 0.22); tone(659, 0.16, 0.18, 'sine', 0.22); tone(784, 0.32, 0.35, 'sine', 0.22); break;
          case 'error': tone(200, 0, 0.15, 'sawtooth', 0.08, 150); break;
          case 'success': tone(784, 0, 0.1, 'sine', 0.2); tone(1047, 0.1, 0.22, 'sine', 0.2); break;
          case 'warn': tone(330, 0, 0.12, 'triangle', 0.2); tone(330, 0.16, 0.12, 'triangle', 0.2); break;
          case 'tick': tone(1000, 0, 0.03, 'square', 0.05); break;
        }
      } catch (e) { /* audio tidak tersedia */ }
    },
    /** Pilih suara yang sesuai untuk sebuah langkah. */
    forMove: function (m, status) {
      if (status && status.over) return Sound.play('end');
      if (status && status.check) return Sound.play('check');
      if (m.promotion) return Sound.play('promote');
      if (m.castle) return Sound.play('castle');
      if (m.captured) return Sound.play('capture');
      Sound.play('move');
    }
  };
  global.Sound = Sound;
})(window);
