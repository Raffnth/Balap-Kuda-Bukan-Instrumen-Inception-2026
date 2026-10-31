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
    this.voicesLoaded = false;
    this.steadyBuzzed = false;
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

  // Pilih suara bahasa Indonesia. Android dapat melaporkan kode bahasa sebagai "id-ID", "id_ID",
  // atau kode lama Java "in-ID"/"in_ID"; sebagian hanya bisa dikenali dari namanya ("Indonesia").
  // Tanpa suara Indonesia, browser memakai suara bawaan (biasanya Inggris) sehingga logatnya tidak jelas.
  _pickVoice() {
    try {
      const voices = window.speechSynthesis.getVoices() || [];
      const norm = (l) => (l || '').toLowerCase().replace('_', '-');
      const isId = (v) => {
        const l = norm(v.lang);
        return l === 'id' || l === 'in' || l === 'ind' || l.startsWith('id-') || l.startsWith('in-') || /indonesia/i.test(v.name);
      };
      const ids = voices.filter(isId);
      this.voice =
        ids.find((v) => v.localService && /google/i.test(v.name)) ||
        ids.find((v) => v.localService) ||
        ids.find((v) => /google/i.test(v.name)) ||
        ids[0] ||
        null;
      this.voicesLoaded = voices.length > 0;
    } catch {
      this.voice = null;
    }
  }

  // Status suara untuk ditampilkan di beranda: 'ok' (ada suara Indonesia), 'missing', atau 'unknown'.
  voiceStatus() {
    if (!this.speechSupported) return 'missing';
    if (!this.voice) this._pickVoice();
    if (this.voice) return 'ok';
    return this.voicesLoaded ? 'missing' : 'unknown';
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

  // Ucapkan teks. interrupt=true memotong ucapan sebelumnya. rate: kecepatan bicara (1 = normal).
  say(text, { interrupt = false, rate = 1 } = {}) {
    if (!text || !this.speechSupported) return Promise.resolve();
    const synth = window.speechSynthesis;
    const id = (this.sayId = (this.sayId || 0) + 1);
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        // Hanya ucapan terakhir yang boleh menandai "selesai bicara".
        if (this.sayId === id) this.speaking = false;
        resolve();
      };
      try {
        if (!this.voice) this._pickVoice(); // daftar suara di Android sering baru tersedia belakangan
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'id-ID';
        if (this.voice) {
          try {
            u.voice = this.voice;
            u.lang = (this.voice.lang || 'id-ID').replace('_', '-');
          } catch {
            u.lang = 'id-ID';
          }
        }
        u.rate = rate;
        u.pitch = 1;
        u.onend = finish;
        u.onerror = finish;
        // Pengaman bila event onend tidak pernah datang (terjadi di beberapa browser).
        setTimeout(finish, 800 + (text.length * 90) / rate);
        this.speaking = true;
        // Simpan referensi: di Chrome, ucapan yang terhapus dari memori tidak memicu onend.
        this.utterances = (this.utterances || []).slice(-4).concat(u);
        this.lastSpoken = text;
        this.lastSpokenAt = performance.now();
        const busy = synth.speaking || synth.pending;
        if (interrupt && busy) {
          synth.cancel();
          // Chrome Android kadang mengabaikan ucapan yang dikirim tepat setelah cancel(); beri jeda singkat.
          setTimeout(() => {
            if (!done && this.sayId === id) synth.speak(u);
            else finish();
          }, 80);
        } else {
          synth.speak(u);
        }
      } catch {
        finish();
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
    if (!this.vibrationSupported) return false;
    try {
      return navigator.vibrate(pattern);
    } catch {
      return false;
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
    this.steadyBuzzed = false;
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
    // Getar pendek mengikuti ketukan nada (laju makin cepat saat jarak makin jauh dari ideal),
    // agar arahan tetap terasa walaupun suara ponsel kecil atau lingkungan bising.
    this.vibrate(25);
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
    // Getar ganda sekali saat posisi tepat: tanda "tahan".
    if (!this.steadyBuzzed) {
      this.steadyBuzzed = true;
      this.vibrate([70, 50, 70]);
    }
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
    this.steadyBuzzed = false;
  }

  // Uji suara dan getar dari beranda (dipanggil dari ketukan pengguna).
  test() {
    this.unlock();
    this.vibrate([200, 100, 200]);
    this._blip(660, -0.8, 0.12, 0.35);
    setTimeout(() => this._blip(880, 0.8, 0.12, 0.35), 220);
    return this.say('Uji suara SonarID. Jika ponsel bergetar dan suara ini terdengar jelas, semuanya siap.', { interrupt: true });
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
