// Pengenalan wajah dengan MediaPipe Face Landmarker (478 titik wajah), berjalan di perangkat.
// Versi file WASM harus sama persis dengan versi paket @mediapipe/tasks-vision di package.json.

export const MEDIAPIPE_VERSION = '0.10.3';
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let landmarkerPromise = null;

export function loadFaceLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      const options = (delegate) => ({
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      try {
        return await FaceLandmarker.createFromOptions(fileset, options('GPU'));
      } catch {
        // Sebagian ponsel tidak mendukung GPU di browser: gunakan CPU.
        return await FaceLandmarker.createFromOptions(fileset, options('CPU'));
      }
    })().catch((err) => {
      landmarkerPromise = null; // izinkan mencoba lagi
      throw err;
    });
  }
  return landmarkerPromise;
}

let lastTs = 0;
export function detectFace(landmarker, video) {
  // Stempel waktu wajib selalu naik untuk mode VIDEO.
  let ts = performance.now();
  if (ts <= lastTs) ts = lastTs + 1;
  lastTs = ts;
  const result = landmarker.detectForVideo(video, ts);
  const points = result && result.faceLandmarks && result.faceLandmarks[0];
  return points && points.length >= 468 ? analyzeFace(points) : { found: false };
}

// Indeks titik penting pada model 478 titik.
const NOSE = 1;
const EYE_A = 33; // sudut luar mata (sisi kiri gambar)
const EYE_B = 263; // sudut luar mata (sisi kanan gambar)
const CHEEK_A = 234;
const CHEEK_B = 454;

// Koordinat titik dinormalisasi 0..1 terhadap lebar dan tinggi gambar (belum dicerminkan).
export function analyzeFace(points) {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const faceW = Math.max(1e-6, maxX - minX);
  const nose = points[NOSE];
  const a = points[CHEEK_A];
  const b = points[CHEEK_B];
  const eyeA = points[EYE_A];
  const eyeB = points[EYE_B];
  // Toleh kiri-kanan: posisi hidung terhadap kedua pipi (-1..1, 0 = lurus).
  const yaw = ((nose.x - a.x) - (b.x - nose.x)) / faceW;
  // Miring kepala/ponsel: sudut garis kedua mata (derajat, 0 = datar).
  const roll = (Math.atan2(eyeB.y - eyeA.y, eyeB.x - eyeA.x) * 180) / Math.PI;
  return {
    found: true,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    size: maxY - minY, // tinggi wajah relatif terhadap tinggi frame
    yaw,
    roll,
    bbox: { x: minX, y: minY, w: faceW, h: maxY - minY },
  };
}
