#!/usr/bin/env node
// Menyiapkan komponen AI pihak ketiga agar disajikan dari situs sendiri (public/vendor).
// Dijalankan otomatis sebelum "npm run build" (prebuild). Hasilnya tidak dimasukkan ke git (.gitignore).
//
// Isi public/vendor setelah skrip ini:
//   mediapipe/wasm/*                 disalin dari node_modules/@mediapipe/tasks-vision/wasm
//   mediapipe/face_landmarker.task   model wajah, diunduh dari Google (sekali, lalu dipakai ulang)
//   tesseract/worker.min.js          disalin dari node_modules/tesseract.js/dist
//   tesseract/core/*                 disalin dari node_modules/tesseract.js-core
//   tesseract/lang/eng.traineddata.gz  data bahasa OCR, diunduh dari jsDelivr (sekali)
//   vendor.json                      versi dan sidik SHA-256 setiap berkas
//
// Bila unduhan gagal (misalnya tanpa internet), aplikasi tetap berjalan: bagian yang tidak tersedia
// otomatis memakai CDN resmi (lihat src/lib/vendor.js). Pilihan: --offline (lewati unduhan).

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'vendor');
const OFFLINE = process.argv.includes('--offline');
const NM = join(ROOT, 'node_modules');

const MEDIAPIPE_VERSION = '0.10.3'; // harus sama dengan src/lib/vendor.js dan package.json
const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const ENG_URL = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz';

const log = (m) => console.log(`[assets] ${m}`);
const pkgVersion = (dir) => {
  try {
    return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
  } catch {
    return null;
  }
};

function copyDir(src, dst, filter = () => true) {
  mkdirSync(dst, { recursive: true });
  let n = 0;
  for (const f of readdirSync(src)) {
    const p = join(src, f);
    if (statSync(p).isFile() && filter(f)) {
      copyFileSync(p, join(dst, f));
      n++;
    }
  }
  return n;
}

async function download(url, dst, minBytes) {
  if (existsSync(dst) && statSync(dst).size >= minBytes) return true;
  if (OFFLINE) return false;
  try {
    log(`mengunduh ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < minBytes) throw new Error(`ukuran tidak wajar (${buf.length} byte)`);
    mkdirSync(dirname(dst), { recursive: true });
    writeFileSync(dst, buf);
    return true;
  } catch (err) {
    log(`gagal mengunduh (${err.message}); bagian ini akan memakai CDN`);
    return false;
  }
}

// Tanpa tanggal: isi berkas hanya berubah bila komponen berubah, sehingga cache di ponsel tidak dibuang sia-sia.
const manifest = { mediapipe: null, faceModel: false, tesseract: null, tesseractLang: false, files: {} };

// MediaPipe
const mpDir = join(NM, '@mediapipe', 'tasks-vision');
const mpVer = pkgVersion(mpDir);
if (mpVer && existsSync(join(mpDir, 'wasm'))) {
  if (mpVer !== MEDIAPIPE_VERSION) {
    log(`PERINGATAN: @mediapipe/tasks-vision ${mpVer}, seharusnya ${MEDIAPIPE_VERSION}. Jalankan: npm i -E @mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`);
  } else {
    const n = copyDir(join(mpDir, 'wasm'), join(OUT, 'mediapipe', 'wasm'));
    manifest.mediapipe = mpVer;
    log(`MediaPipe ${mpVer}: ${n} berkas WASM disalin`);
    manifest.faceModel = await download(FACE_MODEL_URL, join(OUT, 'mediapipe', 'face_landmarker.task'), 1_000_000);
  }
} else {
  log('MediaPipe tidak ditemukan di node_modules (jalankan npm install); memakai CDN');
}

// Tesseract
const tjsDir = join(NM, 'tesseract.js');
const coreDir = [join(NM, 'tesseract.js-core'), join(tjsDir, 'node_modules', 'tesseract.js-core')].find((d) => existsSync(d));
const tjsVer = pkgVersion(tjsDir);
if (tjsVer && coreDir && existsSync(join(tjsDir, 'dist', 'worker.min.js'))) {
  mkdirSync(join(OUT, 'tesseract'), { recursive: true });
  copyFileSync(join(tjsDir, 'dist', 'worker.min.js'), join(OUT, 'tesseract', 'worker.min.js'));
  // Hanya varian LSTM (SonarID memakai OEM 1 = LSTM), dengan dan tanpa SIMD.
  const n = copyDir(coreDir, join(OUT, 'tesseract', 'core'), (f) => /^tesseract-core(-simd)?-lstm\.wasm\.js$/.test(f));
  manifest.tesseract = tjsVer;
  log(`Tesseract.js ${tjsVer}: worker dan ${n} berkas inti disalin (inti ${pkgVersion(coreDir)})`);
  manifest.tesseractLang = await download(ENG_URL, join(OUT, 'tesseract', 'lang', 'eng.traineddata.gz'), 500_000);
} else {
  log('Tesseract.js tidak ditemukan di node_modules (jalankan npm install); memakai CDN');
}

// Sidik SHA-256 setiap berkas (bukti keutuhan; juga memudahkan pemeriksaan juri/penyedia).
function walk(dir) {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f !== 'vendor.json') {
      manifest.files[relative(OUT, p).split('\\').join('/')] = createHash('sha256').update(readFileSync(p)).digest('hex');
    }
  }
}
walk(OUT);
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'vendor.json'), `${JSON.stringify(manifest, null, 1)}\n`);
log(`vendor.json ditulis (${Object.keys(manifest.files).length} berkas)`);
