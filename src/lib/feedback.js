// Umpan balik non-visual: suara (Web Speech), nada (Web Audio), dan getar (Vibration API).
// Semua fungsi aman dipanggil walaupun fitur tidak didukung perangkat (misalnya getar di iPhone).

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

class Feedback {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.voice = null;
    this.level = 'lengkap';
    this.beepTimer = null;
    this.guide = null; // { pan, pitch, interval }
    this.steady = null; // nada stabil saat "hampir tepat"
    this.lastSpoken = '';
    this.lastSpokenAt = 0;
    this.speaking = false;
    this.unlocked = false;
    this._pickVoice = this._pickVoice.bind(this);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this._pickVoice();
      window.speechSynthesis.addEventListener?.('voiceschanged', this._pickVoice);
    }
  }

  get speechSupported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  get vibrationSupported() {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  _pickVoice() {
    try {
      const voices = window.speechSynthesis.getVoices() || [];
      this.voice =
        voices.find((v) => v.lang === 'id-ID' && /google/i.test(v.name)) ||
        voices.find((v) => v.lang === 'id-ID') ||
        voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('id')) ||
        null;
    } catch {
      this.voice = null;
    }
  }

  // Harus dipanggil dari ketukan pengguna (aturan autoplay browser).
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          this.ctx = new AC();
          this.master = this.ctx.createGain();
          this.master.gain.value = 0.6;
          this.master.connect(this.ctx.destination);
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    } catch {
      this.ctx = null;
    }
    if (this.speechSupported && !this.unlocked) {
      try {
        // Ucapan kosong untuk "membuka" mesin suara pada Android/iOS.
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        u.lang = 'id-ID';
        window.speechSynthesis.speak(u);
      } catch {
        /* abaikan */
      }
    }
    this.unlocked = true;
  }

  setLevel(level) {
    this.level = level;
  }

  // Ucapkan teks. interrupt=true memotong ucapan sebelumnya.
  say(text, { interrupt = false } = {}) {
    if (!text || !this.speechSupported) return Promise.resolve();
    const synth = window.speechSynthesis;
    return new Promise((resolve) => {
      try {
        if (interrupt) synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'id-ID';
        if (this.voice) u.voice = this.voice;
        u.rate = 1.05;
        u.pitch = 1;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          this.speaking = false;
          resolve();
        };
        u.onend = finish;
        u.onerror = finish;
        // Pengaman bila event onend tidak pernah datang (terjadi di beberapa browser).
        setTimeout(finish, 600 + text.length * 90);
        this.speaking = true;
        this.lastSpoken = text;
        this.lastSpokenAt = performance.now();
        synth.speak(u);
      } catch {
        this.speaking = false;
        resolve();
      }
    });
  }

  stopSpeech() {
    if (this.speechSupported) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* abaikan */
      }
    }
    this.speaking = false;
  }

  vibrate(pattern) {
    if (!this.vibrationSupported) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      /* abaikan */
    }
  }

  // Bunyi pendek dengan arah stereo dan tinggi nada tertentu.
  _blip(freq, pan, dur = 0.07, vol = 0.35, type = 'sine') {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(clamp(pan, -1, 1), t);
      osc.connect(p);
      node = p;
    }
    node.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // Nada panduan berulang.
  // moveX: -1 (geser kiri) .. 1 (geser kanan)  -> arah stereo
  // moveY: -1 (turunkan) .. 1 (naikkan)        -> tinggi nada
  // distErr: 0 (jarak ideal) .. 1 (jauh dari ideal) -> laju ketukan (melambat saat mendekati ideal)
  setGuide({ moveX = 0, moveY = 0, distErr = 0 }) {
    this.stopSteady();
    this.guide = {
      pan: clamp(moveX, -1, 1),
      pitch: 660 + clamp(moveY, -1, 1) * 260,
      interval: Math.round(650 - 470 * clamp(distErr * 2, 0, 1)),
    };
    if (!this.beepTimer) this._scheduleBeep();
  }

  _scheduleBeep() {
    if (!this.guide) {
      this.beepTimer = null;
      return;
    }
    this._blip(this.guide.pitch, this.guide.pan);
    this.beepTimer = setTimeout(() => this._scheduleBeep(), this.guide.interval);
  }

  stopGuide() {
    this.guide = null;
    if (this.beepTimer) clearTimeout(this.beepTimer);
    this.beepTimer = null;
  }

  // Nada jernih dan stabil saat posisi hampir tepat.
  startSteady() {
    this.stopGuide();
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.steady) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    this.steady = { osc, gain };
  }

  stopSteady() {
    if (!this.steady || !this.ctx) {
      this.steady = null;
      return;
    }
    const { osc, gain } = this.steady;
    const t = this.ctx.currentTime;
    try {
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      osc.stop(t + 0.08);
    } catch {
      /* abaikan */
    }
    this.steady = null;
  }

  stopTones() {
    this.stopGuide();
    this.stopSteady();
  }

  // Bunyi rana kamera + getar singkat saat foto diambil.
  shutter() {
    this.stopTones();
    const ctx = this.ctx;
    if (ctx && ctx.state === 'running') {
      const t = ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * 0.06);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      g.gain.value = 0.5;
      src.buffer = buf;
      src.connect(g);
      g.connect(this.master);
      src.start(t);
    }
    this.vibrate(90);
  }

  // Nada naik: berhasil.
  success() {
    this._blip(660, 0, 0.12, 0.3);
    setTimeout(() => this._blip(990, 0, 0.18, 0.3), 130);
    this.vibrate([60, 60, 60]);
  }

  // Nada turun: gagal.
  fail() {
    this._blip(520, 0, 0.14, 0.3, 'triangle');
    setTimeout(() => this._blip(330, 0, 0.22, 0.3, 'triangle'), 150);
    this.vibrate([200, 100, 200]);
  }

  stopAll() {
    this.stopTones();
    this.stopSpeech();
  }
}

export const feedback = new Feedback();
