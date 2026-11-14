// Lokasi berkas komponen AI pihak ketiga (MediaPipe dan Tesseract).
// Bila "npm run assets" sudah dijalankan sebelum build, semua berkas disajikan dari situs sendiri
// (folder /vendor, dengan daftar dan sidik SHA-256 di /vendor/vendor.json). Keuntungannya:
// tidak bergantung pada CDN pihak ketiga saat demo, lebih cepat, dan kebijakan keamanan lebih ketat.
// Bila folder itu tidak ada, dipakai CDN resmi sebagai cadangan sehingga aplikasi tetap berjalan.

export const MEDIAPIPE_VERSION = '0.10.3';

export const CDN = {
  mediapipeWasm: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`,
  faceModel:
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
};

const abs = (p) => new URL(p, window.location.href).href;

let manifestPromise = null;

export function loadVendorManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch('/vendor/vendor.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => (v && typeof v === 'object' && v.files ? v : null))
      .catch(() => null);
  }
  return manifestPromise;
}

// Sumber MediaPipe: daftar urutan percobaan (lokal dulu bila tersedia, lalu CDN).
export async function mediapipeSources() {
  const v = await loadVendorManifest();
  const list = [];
  if (v && v.mediapipe === MEDIAPIPE_VERSION) {
    list.push({
      local: true,
      wasm: abs('/vendor/mediapipe/wasm'),
      model: v.faceModel ? abs('/vendor/mediapipe/face_landmarker.task') : CDN.faceModel,
    });
  }
  list.push({ local: false, wasm: CDN.mediapipeWasm, model: CDN.faceModel });
  return list;
}

// Opsi Tesseract: daftar urutan percobaan (lokal dulu bila tersedia, lalu bawaan Tesseract.js = CDN).
export async function tesseractOptions() {
  const v = await loadVendorManifest();
  const list = [];
  if (v && v.tesseract && v.tesseractLang) {
    list.push({
      local: true,
      options: {
        workerPath: abs('/vendor/tesseract/worker.min.js'),
        corePath: abs('/vendor/tesseract/core'),
        langPath: abs('/vendor/tesseract/lang'),
        workerBlobURL: false,
      },
    });
  }
  list.push({ local: false, options: {} });
  return list;
}
