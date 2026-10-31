import { useEffect, useRef, useState } from 'react';
import { openCamera, stopCamera, waitForVideo, improveFocus } from '../lib/camera.js';
import {
  grabFrame,
  toGray,
  meanBrightness,
  lightStats,
  sharpness,
  captureFull,
  cropCanvas,
  visibleCrop,
} from '../lib/vision/imageTools.js';
import { detectCard } from '../lib/vision/card.js';
import { loadFaceLandmarker, detectFace } from '../lib/vision/face.js';
import { readNik, warmUpOcr } from '../lib/vision/ocr.js';
import { decide, ktpReadable, Stabilizer, TARGETS } from '../lib/engine.js';
import { feedback } from '../lib/feedback.js';
import { MedianTracker, KeyVoter } from '../lib/tracking.js';
import {
  guideText,
  eventText,
  SCREEN_TEXT,
  ktpGuideText,
  ktpScreenText,
  extraText,
} from '../lib/messages.js';
import { recordLatency, recordStep } from '../lib/metrics.js';
import { IconBack } from './Icons.jsx';

const FRAME_INTERVAL = 66; // sekitar 15 analisis per detik
const ANALYSIS_W = 192; // lebar frame untuk analisis cepat
const MAX_ATTEMPTS = 3;
const BURST = 3; // jumlah frame yang diambil saat memotret; dipilih yang paling tajam
const BURST_GAP = 90; // ms antarframe

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Instruksi KTP yang saling berlawanan (untuk mendeteksi gerakan yang kelewatan).
const OPPOSITE = {
  kiri: 'kanan',
  kanan: 'kiri',
  atas: 'bawah',
  bawah: 'atas',
  dekatkan: 'jauhkan',
  jauhkan: 'dekatkan',
  putar_kanan: 'putar_kiri',
  putar_kiri: 'putar_kanan',
};
const DIRECTIONAL = new Set(['kiri', 'kanan', 'atas', 'bawah', 'dekatkan', 'jauhkan', 'putar_kanan', 'putar_kiri']);
// Berapa lama (ms) instruksi harus konsisten sebelum diucapkan.
const STABLE_MS = { cari_ktp: 700, gelap: 1000, silau: 500, tahan: 200 };
const STABLE_DEFAULT = 300;
// Bila layar sudah menyatakan "Posisi tepat" selama ini (ms) dan kartu terlihat, foto pasti diambil.
const TAHAN_FORCE_MS = 1500;
// Mode diagnosis: tambahkan ?debug=1 pada alamat untuk melihat angka deteksi di bawah kamera.
const DEBUG = typeof window !== 'undefined' && /[?&]debug=1/.test(window.location.search);

// Perkiraan awal jenis kamera sebelum kamera dibuka (untuk kalimat pembuka).
function guessKtpCam() {
  if (typeof navigator === 'undefined') return 'rear';
  const ua = navigator.userAgent || '';
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  return mobile ? 'rear' : 'front';
}

// Jenis kamera yang benar-benar terbuka: kamera belakang ponsel ('rear') atau webcam/kamera depan ('front').
function detectKtpCam(stream, guess) {
  try {
    const track = stream.getVideoTracks()[0];
    const fm = track && track.getSettings ? track.getSettings().facingMode : undefined;
    if (fm === 'environment') return 'rear';
    if (fm === 'user') return 'front';
  } catch {
    /* abaikan */
  }
  return guess;
}

// Ubah koordinat wajah (relatif terhadap frame penuh) menjadi relatif terhadap bagian yang terlihat.
function faceToCrop(m, crop, vw, vh) {
  if (!m.found || !crop) return m;
  const fx = (x) => (x * vw - crop.sx) / crop.sw;
  const fy = (y) => (y * vh - crop.sy) / crop.sh;
  const b = m.bbox;
  return {
    ...m,
    cx: fx(m.cx),
    cy: fy(m.cy),
    size: (m.size * vh) / crop.sh,
    bbox: { x: fx(b.x), y: fy(b.y), w: (b.w * vw) / crop.sw, h: (b.h * vh) / crop.sh },
  };
}

// Kotak tampilan kamera berasio 3:4; dipakai juga saat kotak disembunyikan (mode non-visual).
function boxSize(el) {
  const w = el ? el.clientWidth : 0;
  const h = el ? el.clientHeight : 0;
  return w > 0 && h > 0 ? [w, h] : [3, 4];
}

function rectOf(bbox, W, H) {
  return { x: bbox.x * W, y: bbox.y * H, w: bbox.w * W, h: bbox.h * H };
}

function regionStats(photo, bbox, maxW) {
  const safe = bbox && bbox.w > 0 && bbox.h > 0 ? bbox : { x: 0, y: 0, w: 1, h: 1 };
  const rect = rectOf(safe, photo.width, photo.height);
  const crop = cropCanvas(photo, rect, { scale: Math.min(1, maxW / Math.max(1, rect.w)) });
  const ctx = crop.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, crop.width, crop.height);
  const g = toGray(img.data, crop.width, crop.height);
  const ls = lightStats(g, crop.width, crop.height);
  return {
    sharp: sharpness(g, crop.width, crop.height),
    light: ls.mean,
    glare: ls.glare,
  };
}

async function checkKtp(photo, m, cam) {
  const front = cam === 'front';
  const s = regionStats(photo, m.bbox, 800);
  const ocr = await readNik(photo, m);
  const nikSkipped = !!ocr.error;
  const checks = [
    {
      id: 'sharp',
      label: 'Ketajaman',
      ok: s.sharp >= 20,
      detail: s.sharp >= 20 ? 'Foto tajam' : 'Foto buram',
      advice: front ? 'Foto buram. Tahan KTP lebih diam.' : 'Foto buram. Tahan ponsel lebih diam.',
    },
    {
      id: 'light',
      label: 'Cahaya',
      ok: s.light >= TARGETS.ktp.minLight && s.light <= 245,
      detail: s.light < TARGETS.ktp.minLight ? 'Terlalu gelap' : s.light > 245 ? 'Terlalu terang' : 'Cahaya cukup',
      advice:
        s.light < TARGETS.ktp.minLight
          ? 'Foto terlalu gelap. Nyalakan lampu atau pindah ke tempat yang lebih terang.'
          : 'Foto terlalu terang. Hindari cahaya langsung ke KTP.',
    },
    {
      id: 'glare',
      label: 'Pantulan cahaya',
      ok: s.glare < TARGETS.ktp.maxGlare,
      detail: s.glare < TARGETS.ktp.maxGlare ? 'Tidak ada silau' : 'Ada silau',
      advice: front ? 'Ada pantulan cahaya di KTP. Miringkan KTP sedikit.' : 'Ada pantulan cahaya di KTP. Miringkan ponsel sedikit.',
    },
    {
      id: 'nik',
      label: 'Keterbacaan NIK',
      ok: nikSkipped || (ocr.readable && !ocr.upsideDown),
      warn: nikSkipped,
      detail: nikSkipped
        ? 'Tidak dapat diperiksa (koneksi)'
        : ocr.upsideDown
          ? 'KTP terbalik'
          : ocr.readable
            ? 'NIK terbaca'
            : 'NIK belum terbaca',
      advice: ocr.upsideDown
        ? 'KTP terbalik. Putar KTP setengah putaran.'
        : front
          ? 'NIK belum terbaca jelas. Dekatkan KTP ke kamera dan tahan.'
          : 'NIK belum terbaca jelas. Dekatkan ponsel ke KTP dan tahan.',
    },
  ];
  return { ok: checks.every((c) => c.ok), checks };
}

function checkSelfie(photo, m, decision) {
  const s = regionStats(photo, m.bbox, 480);
  const checks = [
    { id: 'face', label: 'Wajah terdeteksi', ok: !!m.found, detail: 'Satu wajah terlihat', advice: 'Wajah tidak terlihat.' },
    {
      id: 'pos',
      label: 'Posisi wajah',
      ok: !!decision && decision.ok,
      detail: decision && decision.ok ? 'Posisi tepat' : 'Posisi belum tepat',
      advice: 'Posisi wajah belum tepat.',
    },
    {
      id: 'sharp',
      label: 'Ketajaman',
      ok: s.sharp >= 8,
      detail: s.sharp >= 8 ? 'Wajah tajam' : 'Wajah buram',
      advice: 'Foto buram. Tahan ponsel lebih diam.',
    },
    {
      id: 'light',
      label: 'Cahaya',
      ok: s.light >= 60 && s.light <= 235,
      detail: s.light < 60 ? 'Terlalu gelap' : s.light > 235 ? 'Terlalu terang' : 'Cahaya cukup',
      advice: s.light < 60 ? 'Wajah terlalu gelap. Hadapkan wajah ke cahaya.' : 'Wajah terlalu terang.',
    },
    {
      id: 'yaw',
      label: 'Arah wajah',
      ok: Math.abs(m.yaw) <= 0.25,
      detail: Math.abs(m.yaw) <= 0.25 ? 'Menghadap lurus' : 'Wajah menoleh',
      advice: 'Hadapkan wajah lurus ke kamera.',
    },
  ];
  return { ok: checks.every((c) => c.ok), checks };
}

export default function Guide({ mode, settings, session, onDone, onHelp, onExit }) {
  const videoRef = useRef(null);
  const viewportRef = useRef(null);
  const callbacks = useRef({ onDone, onHelp });
  callbacks.current = { onDone, onHelp };

  const [phase, setPhase] = useState('loading'); // loading | intro | guiding | checking | error
  const [instr, setInstr] = useState(null);
  const [ok, setOk] = useState(false);
  const [progress, setProgress] = useState(0);
  const [latency, setLatency] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [runId, setRunId] = useState(0);
  const [cam, setCam] = useState(guessKtpCam);
  const [box, setBox] = useState(null); // kotak kartu yang terdeteksi (koordinat tampilan)
  const [debug, setDebug] = useState('');
  const [upright, setUpright] = useState(false); // ponsel dipegang tegak (kamera belakang)
  const level = settings.detail;
  const isKtp = mode === 'ktp';

  useEffect(() => {
    let cancelled = false;
    let stream = null;
    let raf = 0;
    let wakeLock = null;
    let landmarker = null;
    const canvas = document.createElement('canvas');
    const stab = new Stabilizer();
    // Jalur cadangan KTP: bila kartu sudah cukup terlihat untuk dibaca (walau belum ideal)
    // selama sekitar 2,5 detik, foto tetap diambil otomatis.
    const fallback = new Stabilizer(2500, 2500, 0.3, 1500);
    const tracker = new MedianTracker(400, 0.5); // KTP: median beberapa frame terakhir
    const voter = new KeyVoter(450); // KTP: instruksi yang paling konsisten
    let ktpCam = guessKtpCam();
    // Catatan ucapan instruksi KTP.
    const talk = { key: null, at: 0, err: null, repeats: 0, dir: null, dirAt: 0 };
    const st = {
      phase: 'loading',
      lastKey: null,
      lastSayAt: 0,
      lastOk: false,
      lastM: null,
      lastDecision: null,
      attempts: 0,
      lastFrame: 0,
      latSum: 0,
      latN: 0,
      lastUi: 0,
      lastLatUi: 0,
      tilt: undefined,
      beta: undefined,
      smooth: null,
      lastFoundAt: 0,
      crop: null,
      startedAt: performance.now(),
    };
    const setP = (p) => {
      st.phase = p;
      if (!cancelled) setPhase(p);
    };
    const onOrient = (e) => {
      if (typeof e.gamma === 'number') st.tilt = e.gamma;
      if (typeof e.beta === 'number') st.beta = e.beta;
    };
    // Ponsel tegak bila kemiringan depan-belakang lebih dari 50 derajat (mendatar = sekitar 0).
    const isUpright = () => typeof st.beta === 'number' && Math.abs(st.beta) > 50 && Math.abs(st.beta) < 130;

    const speakGuide = (key, now, isOk) => {
      let text = guideText(key, level);
      const searching = key === 'cari_ktp' || key === 'cari_wajah' || key === 'gelap';
      if (!text && level === 'nada' && searching) text = guideText(key, 'ringkas');
      if (!text) {
        st.lastKey = key;
        return;
      }
      const since = now - st.lastSayAt;
      if (key !== st.lastKey) {
        if (since > 1200) {
          feedback.say(text, { interrupt: true });
          st.lastSayAt = now;
          st.lastKey = key;
        }
      } else if (!isOk && since > (searching ? 6000 : 3500)) {
        feedback.say(text);
        st.lastSayAt = now;
      }
    };

    // Ambil beberapa frame berurutan lalu pilih yang paling tajam (mengurangi foto buram karena getaran).
    async function takeBestPhoto(video, crop, bbox) {
      let best = null;
      for (let i = 0; i < BURST; i++) {
        if (i > 0) await wait(BURST_GAP);
        if (cancelled || !video || video.readyState < 2) break;
        const photo = captureFull(video, 1600, crop);
        const sharp = regionStats(photo, bbox, 400).sharp;
        if (!best || sharp > best.sharp) best = { photo, sharp };
      }
      return best ? best.photo : captureFull(video, 1600, crop);
    }

    // Deteksi ulang kartu pada foto terpilih agar area NIK tepat.
    function refineCard(photo, m) {
      const img = grabFrame(photo, canvas, ANALYSIS_W);
      if (!img) return m;
      const again = detectCard(img);
      return again.found ? { ...m, ...again } : m;
    }

    // Ucapan instruksi KTP:
    // 1) instruksi baru diucapkan hanya bila sudah konsisten beberapa saat (STABLE_MS),
    // 2) instruksi berlawanan dengan yang baru diucapkan (gerakan kelewatan) harus lebih konsisten
    //    dan diawali "Kelewatan",
    // 3) instruksi yang sama diulang tiap ~3,5 detik; bila pengguna sudah bergerak ke arah yang benar,
    //    yang diucapkan cukup "Bagus, terus",
    // 4) kegelapan yang berulang diucapkan "Masih terlalu gelap".
    const speakKtp = (vote, d, now) => {
      const key = vote.key;
      const searching = key === 'cari_ktp' || key === 'gelap';
      const lvl = level === 'nada' && searching ? 'ringkas' : level;
      if (lvl === 'nada') {
        talk.key = key;
        return;
      }
      const stableFor = now - vote.since;
      // Kelewatan: instruksi berlawanan dengan instruksi arah terakhir yang diucapkan dalam 3 detik terakhir.
      const opposite = !!OPPOSITE[key] && OPPOSITE[key] === talk.dir && now - talk.dirAt < 3000;
      const need = (STABLE_MS[key] ?? STABLE_DEFAULT) + (opposite ? 300 : 0);
      if (stableFor < need) return;
      const since = now - talk.at;
      const err = vote.key === d.key ? d.err : null;
      const small = vote.key === d.key && !!d.small;
      if (key !== talk.key) {
        if (feedback.speaking && since < 600) return; // biarkan kalimat sebelumnya terdengar sebentar
        let text = ktpGuideText(key, lvl, ktpCam, { small, upright: isUpright() });
        if (!text) return;
        if (opposite) text = `${extraText('kelewatan', lvl)} ${text}`;
        feedback.say(text, { interrupt: true });
        talk.key = key;
        talk.at = now;
        talk.err = err;
        talk.repeats = 0;
        if (DIRECTIONAL.has(key)) {
          talk.dir = key;
          talk.dirAt = now;
        }
        return;
      }
      if (key === 'tahan') return;
      const gap = key === 'cari_ktp' ? 6000 : 3000;
      if (since < gap || feedback.speaking) return;
      let text;
      if (DIRECTIONAL.has(key) && err != null && talk.err != null && err < talk.err * 0.8) {
        text = extraText('terus', lvl);
      } else {
        text = ktpGuideText(key, lvl, ktpCam, { small, again: true, upright: isUpright() });
      }
      if (!text) return;
      feedback.say(text);
      talk.at = now;
      talk.err = err;
      talk.repeats += 1;
    };

    async function capture(m) {
      setP('checking');
      stab.reset();
      fallback.reset();
      feedback.shutter();
      const video = videoRef.current;
      const crop = st.crop;
      const decision = st.lastDecision;
      const sayP = feedback.say(eventText(isKtp ? 'capturedKtp' : 'capturedSelfie', level), { interrupt: true });
      // Bila pemeriksaan lama (misalnya OCR pertama kali mengunduh data), beri kabar agar pengguna tidak bingung.
      const waitTimer = setInterval(() => {
        if (!cancelled) feedback.say('Masih memeriksa. Tunggu sebentar.');
      }, 7000);
      let photo;
      let result;
      try {
        photo = await takeBestPhoto(video, crop, m.bbox);
        if (cancelled) return;
        result = isKtp ? await checkKtp(photo, refineCard(photo, m), ktpCam) : checkSelfie(photo, m, decision);
      } finally {
        clearInterval(waitTimer);
      }
      await sayP;
      if (cancelled) return;
      st.attempts += 1;
      recordStep(session, mode, {
        attempt: true,
        ok: result.ok,
        durationMs: Math.round(performance.now() - st.startedAt),
      });
      if (result.ok) {
        feedback.success();
        await feedback.say(eventText(isKtp ? 'ktpOk' : 'selfieOk', level), { interrupt: true });
        if (cancelled) return;
        callbacks.current.onDone({
          dataUrl: photo.toDataURL('image/jpeg', 0.9),
          checks: result.checks,
          attempts: st.attempts,
        });
        return;
      }
      feedback.fail();
      const reason = result.checks.find((c) => !c.ok);
      await feedback.say(`${reason ? reason.advice : ''} ${eventText('retry', level)}`, { interrupt: true });
      if (cancelled) return;
      if (st.attempts >= MAX_ATTEMPTS) {
        callbacks.current.onHelp(mode);
        return;
      }
      st.lastKey = null;
      st.lastOk = false;
      st.smooth = null;
      stab.reset();
      fallback.reset();
      tracker.reset();
      voter.reset();
      talk.key = null;
      talk.dir = null;
      talk.at = performance.now();
      setP('guiding');
    }

    function loop(now) {
      if (cancelled) return;
      raf = requestAnimationFrame(loop);
      if (st.phase !== 'guiding' || now - st.lastFrame < FRAME_INTERVAL) return;
      st.lastFrame = now;
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      const t0 = performance.now();
      // Analisis hanya bagian kamera yang terlihat di layar, agar bingkai di layar sesuai dengan penilaian.
      const [bw, bh] = boxSize(viewportRef.current);
      const crop = visibleCrop(video, bw, bh);
      st.crop = crop;
      const img = grabFrame(video, canvas, ANALYSIS_W, crop);
      if (!img) return;
      const W = img.width;
      const H = img.height;
      const gray = toGray(img.data, W, H);
      let m;
      if (isKtp) {
        const raw = detectCard(img, tracker.anchorAt(now));
        if (raw.found && crop) raw.px = raw.size * crop.sw; // lebar kartu dalam piksel kamera asli
        // Cahaya dinilai pada KARTU bila terlihat; bila belum, pada bagian paling terang layar (persentil 95),
        // sehingga latar gelap yang memang dianjurkan tidak dianggap "terlalu gelap".
        raw.frameP95 = lightStats(gray, W, H).p95;
        if (raw.found) {
          const cs = lightStats(gray, W, H, rectOf(raw.bbox, W, H));
          raw.light = cs.mean;
          raw.glare = cs.glare;
        }
        m = tracker.push(raw, now);
      } else {
        try {
          m = faceToCrop(detectFace(landmarker, video), crop, video.videoWidth, video.videoHeight);
        } catch {
          m = { found: false };
        }
        m.light = meanBrightness(gray, W, H, m.found ? rectOf(m.bbox, W, H) : undefined);
        m.tilt = st.tilt;
      }
      // Swafoto: pertahankan wajah terakhir bila hilang sesaat (< 400 ms),
      // dan rata-ratakan posisi agar instruksi tidak berganti-ganti karena getaran tangan.
      // (KTP sudah disaring oleh MedianTracker.)
      if (isKtp) {
        /* sudah disaring */
      } else if (m.found) {
        if (st.smooth && now - st.lastFoundAt < 400) {
          const k = 0.45;
          m.cx = st.smooth.cx + (m.cx - st.smooth.cx) * k;
          m.cy = st.smooth.cy + (m.cy - st.smooth.cy) * k;
          m.size = st.smooth.size + (m.size - st.smooth.size) * k;
          if (m.px !== undefined && crop) m.px = m.size * crop.sw;
        }
        st.smooth = { ...m };
        st.lastFoundAt = now;
      } else if (st.smooth && now - st.lastFoundAt < 400) {
        m = { ...st.smooth, light: st.smooth.light, glare: st.smooth.glare };
      }
      const d = decide(mode, m, st.lastOk, { cam: ktpCam });
      st.lastOk = d.ok;
      st.lastM = m;
      st.lastDecision = d;
      const exact = stab.update(d.ok, m, now);
      const loose = isKtp ? fallback.update(ktpReadable(m), m, now) : 0;
      const prog = Math.max(exact, loose);

      if (!d.found) feedback.stopTones();
      else if (d.ok) feedback.startSteady();
      else feedback.setGuide(d);
      let shownKey = d.key;
      let forceCapture = false;
      if (isKtp) {
        const vote = voter.push(d.key, now);
        speakKtp(vote, d, now);
        shownKey = vote.key; // teks di layar mengikuti instruksi yang konsisten, bukan per frame
        // Pengaman: status "Posisi tepat" yang bertahan berarti kartu sudah layak; jangan menunggu lebih lama.
        forceCapture = vote.key === 'tahan' && m.found && now - vote.since >= TAHAN_FORCE_MS;
      } else {
        speakGuide(d.key, now, d.ok);
      }

      const lat = performance.now() - t0;
      recordLatency(session, lat);
      st.latSum += lat;
      st.latN += 1;
      if (now - st.lastUi > 120) {
        st.lastUi = now;
        setInstr(shownKey);
        setOk(d.ok);
        setProgress(prog);
        if (isKtp) setUpright(isUpright());
        setBox(isKtp && m.found && m.bbox && !m.tooClose ? { ...m.bbox, ok: d.ok } : null);
        if (DEBUG) {
          const f = (v, n = 2) => (typeof v === 'number' ? v.toFixed(n) : '-');
          setDebug(
            `kamera=${isKtp ? ktpCam : 'depan'} suara=${feedback.voice ? feedback.voice.lang : 'TIDAK ADA id'} ` +
              `getar=${feedback.vibrationSupported ? 'ya' : 'tidak'} kunci=${d.key}/${shownKey} ` +
              `ditemukan=${m.found ? 'ya' : 'tidak'}${m.partial ? '(sebagian)' : ''}${m.tooClose ? '(terlalu dekat)' : ''} ` +
              `cx=${f(m.cx)} cy=${f(m.cy)} lebar=${f(m.size)} px=${f(m.px, 0)} sudut=${f(m.angle, 0)} ` +
              `cahaya=${f(m.light, 0)} p95=${f(m.frameP95, 0)} silau=${f(m.glare, 3)} progres=${f(prog)} ` +
              `video=${video.videoWidth}x${video.videoHeight} ${Math.round(lat)}ms`,
          );
        }
      }
      if (now - st.lastLatUi > 1000) {
        st.lastLatUi = now;
        setLatency(st.latSum / st.latN);
      }
      if (prog >= 1 || forceCapture) capture(m);
    }

    async function start() {
      try {
        setP('loading');
        feedback.setLevel(level);
        const introKey = isKtp ? (ktpCam === 'front' ? 'startKtpFront' : 'startKtp') : 'startSelfie';
        const intro = feedback.say(eventText(introKey, level), { interrupt: true });
        const modelP = isKtp ? Promise.resolve(null) : loadFaceLandmarker();
        modelP.catch(() => {}); // ditangani di bawah
        if (isKtp) warmUpOcr().catch(() => {});
        stream = await openCamera(isKtp ? 'environment' : 'user');
        if (cancelled) {
          stopCamera(stream);
          return;
        }
        if (isKtp) {
          ktpCam = detectKtpCam(stream, ktpCam);
          setCam(ktpCam);
          improveFocus(stream);
        }
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play().catch(() => {});
        await waitForVideo(video);
        try {
          landmarker = await modelP;
        } catch (e) {
          const err = new Error(e && e.message ? e.message : 'model');
          err.code = 'model';
          throw err;
        }
        if (cancelled) return;
        try {
          if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
        } catch {
          wakeLock = null;
        }
        setP('intro');
        await intro;
        if (cancelled) return;
        // Cek lingkungan. KTP: bagian paling terang layar (persentil 95), karena latar gelap memang dianjurkan.
        // Swafoto: kecerahan rata-rata.
        const [bw, bh] = boxSize(viewportRef.current);
        const img = grabFrame(video, canvas, ANALYSIS_W, visibleCrop(video, bw, bh));
        let light = 128;
        if (img) {
          const g = toGray(img.data, img.width, img.height);
          light = isKtp ? lightStats(g, img.width, img.height).p95 : meanBrightness(g, img.width, img.height);
        }
        await feedback.say(eventText(light < TARGETS[mode].searchDark ? 'lightLow' : 'lightOk', level));
        if (cancelled) return;
        st.startedAt = performance.now();
        setP('guiding');
        raf = requestAnimationFrame(loop);
      } catch (err) {
        if (cancelled) return;
        const isModel = err && err.code === 'model';
        const msg = eventText(isModel ? 'modelError' : 'cameraError', level);
        setErrorMsg(`${msg}${err && err.message ? ` Detail: ${err.message}` : ''}`);
        setP('error');
        feedback.fail();
        feedback.say(msg, { interrupt: true });
      }
    }

    window.addEventListener('deviceorientation', onOrient);
    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('deviceorientation', onOrient);
      feedback.stopAll();
      stopCamera(stream);
      if (wakeLock) wakeLock.release().catch(() => {});
      const video = videoRef.current;
      if (video) video.srcObject = null;
    };
  }, [mode, runId, level, session, isKtp]);

  const repeatInstruction = () => {
    const lvl = level === 'nada' ? 'ringkas' : level;
    const text = instr ? (isKtp ? ktpGuideText(instr, lvl, cam, { upright }) : guideText(instr, lvl)) : null;
    const intro = isKtp ? (cam === 'front' ? 'startKtpFront' : 'startKtp') : 'startSelfie';
    feedback.say(text || eventText(intro, level), { interrupt: true });
  };

  const stepNo = isKtp ? 1 : 2;
  const title = isKtp ? 'Foto KTP' : 'Swafoto';
  const statusText =
    phase === 'loading'
      ? 'Menyiapkan kamera…'
      : phase === 'intro'
        ? 'Dengarkan petunjuk…'
        : phase === 'checking'
          ? 'Memeriksa kualitas foto…'
          : phase === 'error'
            ? 'Kamera bermasalah'
            : (isKtp ? ktpScreenText(instr, cam, upright) : SCREEN_TEXT[instr]) || 'Mengarahkan…';
  const tone = phase === 'checking' ? 'busy' : ok ? 'ok' : instr && !instr.startsWith('cari') ? 'adjust' : 'search';

  return (
    <main className={`screen guide ${isKtp ? 'mode-ktp' : 'mode-selfie'}`} aria-labelledby="guide-title">
      <div className="guide-top">
        <button type="button" className="icon-btn" onClick={onExit} aria-label="Kembali ke beranda">
          <IconBack />
        </button>
        <div>
          <p className="step">Langkah {stepNo} dari 2</p>
          <h1 id="guide-title">{title}</h1>
        </div>
        <span className="latency" aria-hidden="true">
          {latency != null ? `${Math.round(latency)} ms` : ''}
        </span>
      </div>

      <div ref={viewportRef} className={`viewport tone-${tone}`}>
        {/* Pratinjau dicerminkan untuk kamera depan/webcam agar gerakan di layar searah gerakan tangan. */}
        <video
          ref={videoRef}
          className={!isKtp || cam === 'front' ? 'mirror' : ''}
          muted
          playsInline
          autoPlay
          aria-hidden="true"
        />
        <div className={`target ${isKtp ? 'target-card' : 'target-face'}`} aria-hidden="true" />
        {/* Kotak kartu yang terdeteksi: membantu pendamping/penguji melihat apa yang dibaca sistem. */}
        {phase === 'guiding' && box && (
          <div
            className={`detect-box ${box.ok ? 'ok' : ''}`}
            aria-hidden="true"
            style={{
              left: `${(cam === 'front' ? 1 - box.x - box.w : box.x) * 100}%`,
              top: `${box.y * 100}%`,
              width: `${box.w * 100}%`,
              height: `${box.h * 100}%`,
            }}
          />
        )}
        {phase === 'guiding' && progress > 0 && (
          <div className="hold" aria-hidden="true">
            <span style={{ transform: `scaleX(${progress})` }} />
          </div>
        )}
      </div>

      <p className={`instruction tone-${tone}`} aria-live="off">
        {statusText}
      </p>
      {DEBUG && debug && <p className="debug-line">{debug}</p>}

      {phase === 'error' ? (
        <div className="stack">
          <p className="notice warn" role="alert">
            {errorMsg}
          </p>
          <button type="button" className="btn btn-primary btn-xl" onClick={() => setRunId((r) => r + 1)}>
            Coba lagi
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost repeat" onClick={repeatInstruction}>
          Ulangi petunjuk suara
        </button>
      )}

      {settings.nonVisual && phase !== 'error' && (
        <button
          type="button"
          className="nv-zone"
          onClick={repeatInstruction}
          aria-label={`${title}. Ikuti suara dan nada. Ketuk untuk mengulang petunjuk.`}
        />
      )}
    </main>
  );
}
