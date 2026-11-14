// Umpan balik non-visual: suara, nada (Web Audio), dan getar (Vibration API).
// Suara utama adalah rekaman suara SonarID (berkas di /voice, dibuat dengan TTS neural bahasa Indonesia),
// sehingga logat dan kejelasan sama di semua ponsel tanpa pengaturan apa pun. Web Speech hanya cadangan,
// dan hanya dipakai bila ponsel punya suara bahasa Indonesia (agar tidak terdengar berlogat Inggris).
// Semua fungsi aman dipanggil walaupun fitur tidak didukung perangkat (misalnya getar di iPhone).

import { splitSentences, voiceKey } from './voice-core.js';
import { PHRASES } from './messages.js';

const VOICE_BASE = '/voice/';

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
    // Rekaman suara: kunci kalimat -> nama berkas, isi berkas (ArrayBuffer), dan hasil decode (AudioBuffer).
    this.clipFiles = null;
    this.clipBytes = new Map();
    this.clipDecoded = new Map();
    this.clipBounds = new WeakMap(); // batas suara tanpa jeda hening di awal dan akhir rekaman
    this.clipsReady = false;
    this.clipsLoading = null;
    this.clipsDone = false;
    this.clipSource = null; // potongan suara yang sedang diputar
    this.clipQueue = Promise.resolve();
    this.gen = 0; // bertambah setiap ucapan dipotong; ucapan dari generasi lama berhenti
    this.speechGain = null;
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

  // Muat daftar dan berkas rekaman suara (dipanggil sekali saat aplikasi dibuka).
  loadVoice() {
    if (this.clipsLoading) return this.clipsLoading;
    this.clipsLoading = (async () => {
      try {
        const res = await fetch(`${VOICE_BASE}manifest.json`, { cache: 'no-cache' });
        if (!res.ok) return false;
        const manifest = await res.json();
        const items = manifest && manifest.items;
        if (!items || typeof items !== 'object') return false;
        this.clipFiles = new Map(Object.entries(items).map(([k, v]) => [k, typeof v === 'string' ? v : v.f]));
        const keys = [...this.clipFiles.keys()];
        // Unduh paralel terbatas; berkas kecil (sekitar 5-15 KB per kalimat).
        let i = 0;
        const worker = async () => {
          while (i < keys.length) {
            const k = keys[i++];
            const f = this.clipFiles.get(k);
            if (!/^[a-z0-9_.-]+$/i.test(f)) continue; // hanya nama berkas sederhana
            try {
              const r = await fetch(`${VOICE_BASE}${f}`);
              if (r.ok) this.clipBytes.set(k, await r.arrayBuffer());
            } catch {
              /* lewati berkas yang gagal */
            }
          }
        };
        await Promise.all(Array.from({ length: 6 }, worker));
        this.clipsReady = this.clipBytes.size > 0 && this.clipBytes.size >= keys.length * 0.9;
        if (this.ctx) this._predecode();
        return this.clipsReady;
      } catch {
        return false;
      } finally {
        this.clipsDone = true;
      }
    })();
    return this.clipsLoading;
  }

  hasClip(sentence) {
    return this.clipBytes.has(voiceKey(sentence));
  }

  // Status suara untuk beranda: 'clips' (rekaman SonarID siap), 'ok' (suara Indonesia ponsel),
  // 'missing' (tidak ada keduanya), atau 'unknown' (masih dimuat).
  voiceStatus() {
    if (this.clipsReady) return 'clips';
    if (this.clipsLoading && !this.clipsDone) return 'unknown'; // rekaman masih dimuat
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
          this.speechGain = this.ctx.createGain();
          this.speechGain.gain.value = 1;
          this.speechGain.connect(this.ctx.destination);
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      // iOS Safari: putar satu sampel hening di dalam ketukan agar audio benar-benar terbuka.
      if (this.ctx && !this.silentPlayed) {
        const b = this.ctx.createBuffer(1, 1, 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = b;
        src.connect(this.ctx.destination);
        src.start(0);
        this.silentPlayed = true;
      }
    } catch {
      this.ctx = null;
    }
    if (this.ctx) this._predecode();
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

  // Decode lebih awal kalimat yang paling sering dipakai agar ucapan pertama langsung terdengar.
  _predecode() {
    if (!this.ctx || this._predecoding || !this.clipBytes.size) return;
    this._predecoding = true;
    const keys = [...this.clipBytes.keys()];
    let i = 0;
    // Sedikit demi sedikit saat browser senggang, agar tidak mengganggu analisis kamera.
    const later = (fn) =>
      typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(fn, { timeout: 500 }) : setTimeout(fn, 40);
    const step = () => {
      const batch = keys.slice(i, i + 3);
      i += 3;
      Promise.all(batch.map((k) => this._decode(k).catch(() => null))).then(() => {
        if (i < keys.length) later(step);
      });
    };
    later(step);
  }

  _decode(key) {
    if (this.clipDecoded.has(key)) return this.clipDecoded.get(key);
    const bytes = this.clipBytes.get(key);
    if (!bytes || !this.ctx) return Promise.reject(new Error('tidak ada rekaman'));
    const p = new Promise((resolve, reject) => {
      // Salin agar data asli tetap ada (decodeAudioData mengosongkan ArrayBuffer).
      this.ctx.decodeAudioData(bytes.slice(0), resolve, reject);
    });
    this.clipDecoded.set(key, p);
    p.catch(() => this.clipDecoded.delete(key));
    return p;
  }

  _stopClip() {
    const src = this.clipSource;
    this.clipSource = null;
    if (src) {
      try {
        src.onended = null;
        src.stop();
      } catch {
        /* abaikan */
      }
      if (src._done) src._done();
    }
  }

  // Rekaman TTS biasanya diawali dan diakhiri hening (100-300 ms). Hening itu dilewati agar
  // instruksi terdengar seketika, seperti asisten suara modern.
  _bounds(buffer) {
    let b = this.clipBounds.get(buffer);
    if (b) return b;
    const data = buffer.getChannelData(0);
    const thr = 0.01;
    let s = 0;
    while (s < data.length && Math.abs(data[s]) < thr) s++;
    let e = data.length - 1;
    while (e > s && Math.abs(data[e]) < thr) e--;
    const sr = buffer.sampleRate;
    if (s >= data.length) b = { start: 0, dur: buffer.duration };
    else {
      const start = Math.max(0, s / sr - 0.02);
      const end = Math.min(buffer.duration, e / sr + 0.06);
      b = { start, dur: Math.max(0.05, end - start) };
    }
    this.clipBounds.set(buffer, b);
    return b;
  }

  // Putar satu potongan rekaman; selesai saat potongan habis atau dihentikan.
  async _playClip(key, gen) {
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        /* abaikan */
      }
    }
    return this._decode(key).then(
      (buffer) =>
        new Promise((resolve) => {
          if (this.gen !== gen || !this.ctx || this.ctx.state === 'closed') {
            resolve();
            return;
          }
          const src = this.ctx.createBufferSource();
          src.buffer = buffer;
          src.connect(this.speechGain || this.ctx.destination);
          let done = false;
          src._done = () => {
            if (done) return;
            done = true;
            resolve();
          };
          src.onended = () => {
            if (this.clipSource === src) this.clipSource = null;
            src._done();
          };
          this.clipSource = src;
          const b = this._bounds(buffer);
          src.start(0, b.start, b.dur);
        }),
      () => undefined,
    );
  }

  // Nada panduan dilirihkan selama suara berbicara agar kalimat tetap jelas.
  _duck(on) {
    if (!this.master || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(on ? 0.2 : 0.6, t, 0.05);
    } catch {
      /* abaikan */
    }
  }

  // Ucapkan teks. interrupt=true memotong ucapan sebelumnya. rate: kecepatan bicara untuk suara cadangan.
  // Urutan sumber suara: (1) rekaman SonarID per kalimat, (2) suara bahasa Indonesia milik ponsel,
  // (3) bila keduanya tidak ada: kalimat yang punya rekaman tetap diputar, sisanya tampil di layar saja.
  say(text, { interrupt = false, rate = 1 } = {}) {
    if (!text) return Promise.resolve();
    const ticket = (this.ticket = (this.ticket || 0) + 1);
    // Rekaman masih diunduh (misalnya pengguna langsung menekan Mulai): tunggu sebentar agar kalimat
    // pertama tetap terdengar dengan suara pemandu, bukan diam atau suara ponsel.
    if (this.clipsLoading && !this.clipsDone && this.ctx) {
      const keys = splitSentences(text).map((x) => voiceKey(x));
      if (!keys.every((k) => this.clipBytes.has(k))) {
        return Promise.race([this.clipsLoading, new Promise((r) => setTimeout(r, 3000))]).then(() => {
          if (interrupt && ticket !== this.ticket) return undefined; // sudah ada ucapan yang lebih baru
          return this._sayNow(text, { interrupt, rate });
        });
      }
    }
    return this._sayNow(text, { interrupt, rate });
  }

  _sayNow(text, { interrupt = false, rate = 1 } = {}) {
    const sentences = splitSentences(text);
    const keys = sentences.map((x) => voiceKey(x));
    const ctxOk = !!this.ctx && this.ctx.state !== 'closed';
    if (ctxOk && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    const canClip = ctxOk && keys.some((k) => this.clipBytes.has(k));
    const allClips = canClip && keys.every((k) => this.clipBytes.has(k));
    if (!this.voice && this.speechSupported) this._pickVoice();
    const ttsOk = this.speechSupported && !!this.voice;
    const via = allClips || (canClip && !ttsOk) ? 'clip' : ttsOk ? 'tts' : 'none';
    this._emit(text, via);
    if (via === 'clip') return this._sayClips(text, keys, interrupt);
    if (via === 'tts') return this._sayTts(text, { interrupt, rate });
    return Promise.resolve();
  }

  // Kabar untuk komponen lain (dan pengujian otomatis): kalimat apa yang diucapkan dan dari sumber mana.
  _emit(text, via) {
    try {
      window.dispatchEvent(new CustomEvent('sonarid:say', { detail: { text, via } }));
    } catch {
      /* abaikan */
    }
  }

  _sayClips(text, keys, interrupt) {
    const id = (this.sayId = (this.sayId || 0) + 1);
    if (interrupt) {
      // Generasi baru: semua ucapan yang sedang berjalan atau mengantre dibatalkan.
      this.gen = (this.gen || 0) + 1;
      this._stopClip();
      this._cancelTts();
    }
    const gen = this.gen || 0;
    const run = async () => {
      if (this.gen !== gen) return;
      this.speaking = true;
      this.lastSpoken = text;
      this.lastSpokenAt = performance.now();
      this._duck(true);
      for (let i = 0; i < keys.length; i++) {
        if (this.gen !== gen) break;
        if (!this.clipBytes.has(keys[i])) continue;
        await this._playClip(keys[i], gen);
        if (i < keys.length - 1 && this.gen === gen) await new Promise((r) => setTimeout(r, 90));
      }
      // Hanya ucapan terakhir yang boleh menandai "selesai bicara".
      if (this.sayId === id) {
        this.speaking = false;
        this._duck(false);
      }
    };
    // Tanpa interrupt: antre setelah ucapan yang sedang berjalan.
    const p = interrupt ? run() : this.clipQueue.then(run);
    this.clipQueue = p.catch(() => {});
    return p;
  }

  _cancelTts() {
    if (!this.speechSupported) return;
    try {
      const synth = window.speechSynthesis;
      if (synth.speaking || synth.pending) synth.cancel();
    } catch {
      /* abaikan */
    }
  }

  _sayTts(text, { interrupt = false, rate = 1 } = {}) {
    const synth = window.speechSynthesis;
    const id = (this.sayId = (this.sayId || 0) + 1);
    if (interrupt) {
      this.gen = (this.gen || 0) + 1;
      this._stopClip();
    }
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
    this.sayId = (this.sayId || 0) + 1;
    this.gen = (this.gen || 0) + 1;
    this._stopClip();
    if (this.speechSupported) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* abaikan */
      }
    }
    this.speaking = false;
    this._duck(false);
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
    return this.say(PHRASES.test, { interrupt: true });
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
