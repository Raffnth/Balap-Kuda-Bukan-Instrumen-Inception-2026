// Pembacaan NIK dengan Tesseract.js (OCR di perangkat). Isi NIK tidak pernah diucapkan atau dikirim.

import { cropCanvas, binarize } from './imageTools.js';

let workerPromise = null;

export function warmUpOcr() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      await worker.setParameters({ tessedit_char_whitelist: '0123456789' });
      return worker;
    })().catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('OCR terlalu lama')), ms)),
  ]);
}

// NIK dianggap terbaca bila ada deretan 16 digit dalam satu baris.
// Toleransi satu digit (15-17) dipakai karena ini pemeriksaan keterbacaan foto, bukan pengambilan data:
// penyedia tetap membaca NIK sendiri dari foto.
function findNik(text) {
  const digits = (text || '').replace(/[^0-9\n]/g, '');
  for (const line of digits.split('\n')) {
    const m = line.match(/\d{15,17}/);
    if (m) return m[0];
  }
  return null;
}

// Luruskan foto bila kartu miring (3-45 derajat): putar balik di sekitar pusat kartu,
// karena OCR gagal membaca baris NIK yang miring lebih dari sekitar 10 derajat.
// Mengembalikan { canvas, bbox } (bbox kartu setelah diluruskan) atau null bila tidak perlu.
export function deskew(photo, card) {
  const ang = card && typeof card.angle === 'number' ? card.angle : 0;
  if (!card || !card.size || Math.abs(ang) < 3 || Math.abs(ang) > 45) return null;
  const W = photo.width;
  const H = photo.height;
  const cx = card.cx * W;
  const cy = card.cy * H;
  const cw = card.size * W; // sisi panjang kartu dalam piksel
  const ch = cw / (card.aspect && card.aspect > 1 ? card.aspect : 85.6 / 53.98);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.translate(cx, cy);
  ctx.rotate((-ang * Math.PI) / 180); // sudut positif = kartu terlihat searah jarum jam, jadi putar balik
  ctx.translate(-cx, -cy);
  ctx.drawImage(photo, 0, 0);
  return { canvas: c, bbox: { x: (cx - cw / 2) / W, y: (cy - ch / 2) / H, w: cw / W, h: ch / H } };
}

// Potongan gambar yang dicoba OCR, berurutan: area NIK apa adanya (Tesseract punya ambang sendiri),
// area NIK hitam-putih, area NIK bila KTP terbalik, lalu seluruh kartu.
export function nikCrops(photo, card) {
  const straight = deskew(photo, card);
  const src = straight ? straight.canvas : photo;
  const W = src.width;
  const H = src.height;
  const b = straight ? straight.bbox : card && card.bbox ? card.bbox : { x: 0.1, y: 0.15, w: 0.8, h: 0.7 };
  const box = { x: b.x * W, y: b.y * H, w: b.w * W, h: b.h * H };
  // NIK berada di bagian atas kartu (sekitar 12-40% tinggi kartu).
  const nikArea = { x: box.x + box.w * 0.05, y: box.y + box.h * 0.1, w: box.w * 0.9, h: box.h * 0.32 };
  const nikAreaFlipped = { x: box.x + box.w * 0.05, y: box.y + box.h * 0.58, w: box.w * 0.9, h: box.h * 0.32 };
  const scale = Math.min(3, Math.max(1, 1400 / Math.max(1, nikArea.w)));
  return [
    { canvas: cropCanvas(src, nikArea, { scale }), upsideDown: false },
    { canvas: binarize(cropCanvas(src, nikArea, { scale })), upsideDown: false },
    { canvas: binarize(cropCanvas(src, nikAreaFlipped, { scale, rotate180: true })), upsideDown: true },
    { canvas: cropCanvas(src, box, { scale: Math.min(2, scale) }), upsideDown: false },
  ];
}

// photo: canvas foto KTP. card: hasil detectCard (bbox, pusat, ukuran, sudut dinormalisasi).
// Mengembalikan { readable, upsideDown, error }.
export async function readNik(photo, card) {
  try {
    const worker = await withTimeout(warmUpOcr(), 20000);
    // Semua potongan disiapkan sekaligus (murah); OCR berhenti begitu NIK terbaca.
    const crops = nikCrops(photo, card);
    for (const c of crops) {
      const { data } = await withTimeout(worker.recognize(c.canvas), 10000);
      if (findNik(data && data.text)) return { readable: true, upsideDown: c.upsideDown };
    }
    return { readable: false, upsideDown: false };
  } catch (err) {
    return { readable: false, upsideDown: false, error: err && err.message ? err.message : String(err) };
  }
}
