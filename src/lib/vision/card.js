// Deteksi KTP ringan tanpa pustaka luar.
// Cara kerja: ambang Otsu memisahkan kartu dari latar, komponen terhubung terbesar dipilih,
// lalu momen citra dipakai untuk menghitung pusat, ukuran, rasio sisi, dan kemiringan kartu.
// Kartu ID-1 (ISO/IEC 7810) berukuran 85,60 x 53,98 mm, rasio sisi 1,586.

import { toGray, otsuThreshold } from './imageTools.js';

const ID1_RATIO = 85.6 / 53.98;

function largestComponents(mask, w, h, labels, stack) {
  labels.fill(0);
  let next = 1;
  const comps = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    const id = next++;
    let top = 0;
    stack[top++] = start;
    labels[start] = id;
    let area = 0;
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    while (top) {
      const p = stack[--top];
      const x = p % w;
      const y = (p - x) / w;
      area++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > 0 && mask[p - 1] && !labels[p - 1]) { labels[p - 1] = id; stack[top++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !labels[p + 1]) { labels[p + 1] = id; stack[top++] = p + 1; }
      if (y > 0 && mask[p - w] && !labels[p - w]) { labels[p - w] = id; stack[top++] = p - w; }
      if (y < h - 1 && mask[p + w] && !labels[p + w]) { labels[p + w] = id; stack[top++] = p + w; }
    }
    if (area >= 30) comps.push({ id, area, minX, minY, maxX, maxY });
  }
  comps.sort((a, b) => b.area - a.area);
  return comps.slice(0, 3);
}

// Hitung momen komponen setelah lubang (teks, foto) di dalam kartu diisi.
// Lubang = piksel bukan-komponen yang tidak terhubung ke tepi frame.
function filledMoments(c, labels, w, h, reached, stack) {
  reached.fill(0);
  let top = 0;
  const push = (p) => {
    if (!reached[p] && labels[p] !== c.id) {
      reached[p] = 1;
      stack[top++] = p;
    }
  };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (top) {
    const p = stack[--top];
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < w * (h - 1)) push(p + w);
  }
  let area = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let y = c.minY; y <= c.maxY; y++) {
    for (let x = c.minX; x <= c.maxX; x++) {
      const p = y * w + x;
      if (labels[p] === c.id || !reached[p]) {
        area++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
      }
    }
  }
  return { ...c, rawArea: c.area, area, sx, sy, sxx, syy, sxy };
}

function describe(c, w, h) {
  const n = c.area;
  const cx = c.sx / n;
  const cy = c.sy / n;
  const mu20 = c.sxx / n - cx * cx;
  const mu02 = c.syy / n - cy * cy;
  const mu11 = c.sxy / n - cx * cy;
  const common = Math.sqrt(Math.max(0, ((mu20 - mu02) / 2) ** 2 + mu11 * mu11));
  const l1 = (mu20 + mu02) / 2 + common;
  const l2 = Math.max(1e-6, (mu20 + mu02) / 2 - common);
  // Untuk persegi panjang dengan sisi a, momen orde dua = a^2 / 12.
  const major = Math.sqrt(12 * l1);
  const minor = Math.sqrt(12 * l2);
  const angle = (0.5 * Math.atan2(2 * mu11, mu20 - mu02) * 180) / Math.PI; // derajat, 0 = mendatar
  const aspect = major / Math.max(1e-6, minor);
  const rectangularity = n / Math.max(1e-6, major * minor);
  const touches =
    (c.minX <= 0 ? 1 : 0) + (c.minY <= 0 ? 1 : 0) + (c.maxX >= w - 1 ? 1 : 0) + (c.maxY >= h - 1 ? 1 : 0);
  return {
    holeRatio: c.rawArea ? (n - c.rawArea) / n : 0, // bagian dalam yang terisi (teks, foto) dibanding luas kartu
    cx: cx / w,
    cy: cy / h,
    size: major / w, // lebar kartu relatif terhadap lebar frame
    areaRatio: n / (w * h),
    aspect,
    rectangularity,
    angle,
    touches,
    bbox: {
      x: c.minX / w,
      y: c.minY / h,
      w: (c.maxX - c.minX + 1) / w,
      h: (c.maxY - c.minY + 1) / h,
    },
  };
}

// Kartu yang terpotong satu tepi layar (sebagian keluar bingkai). Tetap dikenali agar pengguna
// mendapat arah geser yang benar, bukan "KTP belum terlihat". Syarat lebih ketat: hanya menyentuh
// satu tepi, berbentuk persegi, dan berisi teks (ada lubang di dalamnya), sehingga dinding terang
// atau jendela tidak ikut dianggap kartu.
function isPartialCard(d) {
  return (
    d.touches === 1 &&
    d.areaRatio >= 0.05 &&
    d.areaRatio <= 0.6 &&
    d.aspect >= 1.0 &&
    d.aspect <= 2.6 &&
    d.rectangularity >= 0.8 &&
    d.holeRatio >= 0.01
  );
}

// Kartu identitas selalu berisi teks dan foto, sehingga di dalam bentuknya ada "lubang" gelap.
// Permukaan polos yang terang (dinding, jendela, kertas kosong) tidak punya lubang dan diabaikan.
function isCardLike(d) {
  return (
    d.holeRatio >= 0.005 &&
    d.areaRatio >= 0.03 &&
    d.areaRatio <= 0.92 &&
    d.touches <= 2 &&
    d.aspect >= 1.25 &&
    d.aspect <= 2.0 &&
    d.rectangularity >= 0.75
  );
}

const buffers = { size: 0, mask: null, labels: null, stack: null, reached: null };

// imageData: hasil getImageData dari frame kamera yang diperkecil (lebar sekitar 160-200 px).
// prev (opsional): posisi kartu terakhir { cx, cy } agar pilihan kandidat tidak melompat-lompat.
export function detectCard(imageData, prev = null) {
  const { data, width: w, height: h } = imageData;
  const gray = toGray(data, w, h);
  const { threshold, variance } = otsuThreshold(gray, true);
  const empty = { found: false, contrast: variance };
  if (variance < 150) return empty; // tidak ada objek yang kontras dengan latar

  const n = w * h;
  if (buffers.size !== n) {
    buffers.size = n;
    buffers.mask = new Uint8Array(n);
    buffers.labels = new Int32Array(n);
    buffers.stack = new Int32Array(n);
    buffers.reached = new Uint8Array(n);
  }
  const { mask, labels, stack, reached } = buffers;

  const candidates = [];
  let close = null; // kartu menutupi hampir seluruh layar (ponsel terlalu dekat)
  // Kartu terang di latar gelap (kasus utama: KTP dan kartu uji), lalu kartu gelap di latar terang.
  for (const bright of [true, false]) {
    for (let i = 0; i < n; i++) mask[i] = bright ? (gray[i] > threshold ? 1 : 0) : gray[i] <= threshold ? 1 : 0;
    for (const comp of largestComponents(mask, w, h, labels, stack)) {
      if (comp.area < 0.02 * n) continue;
      const d = describe(filledMoments(comp, labels, w, h, reached, stack), w, h);
      // Ponsel terlalu dekat: kartu terang menyentuh 3-4 tepi, menutupi sebagian besar layar, dan berisi teks.
      // Hanya dipercaya bila sesaat sebelumnya kartu sudah terlihat besar, agar meja putih tidak dikira kartu.
      if (bright && d.touches >= 3 && d.areaRatio >= 0.5 && d.holeRatio >= 0.01 && prev && prev.size > 0.7) {
        if (!close || d.areaRatio > close.areaRatio) close = d;
        continue;
      }
      const full = isCardLike(d);
      const partial = !full && bright && isPartialCard(d);
      if (!full && !partial) continue;
      const ratioScore = full ? 1 - Math.min(1, Math.abs(d.aspect - ID1_RATIO) / 0.6) : 0;
      const score = d.areaRatio * d.rectangularity * (0.5 + 0.5 * ratioScore) * (partial ? 0.6 : 1);
      candidates.push({ ...d, score, bright, partial });
    }
  }
  if (!candidates.length) {
    if (close) {
      return {
        found: true,
        tooClose: true,
        contrast: variance,
        ...close,
        cx: 0.5,
        cy: 0.5,
        size: 1.05,
        angle: 0,
        bbox: { x: 0, y: 0, w: 1, h: 1 },
      };
    }
    return empty;
  }

  // Kandidat gelap hanya dipakai bila tidak ada kandidat terang. Ini mencegah foto pas pada kartu,
  // badan ponsel, atau bayangan terpilih sebagai "kartu" sehingga muncul instruksi yang salah.
  const bright = candidates.filter((c) => c.bright);
  const pool = bright.length ? bright : candidates;
  let best = null;
  let bestScore = -1;
  for (const c of pool) {
    let sc = c.score;
    if (prev && typeof prev.cx === 'number') {
      const dist = Math.hypot(c.cx - prev.cx, c.cy - prev.cy);
      sc *= 0.4 + 0.6 * Math.exp(-dist / 0.15); // utamakan kandidat yang dekat dengan posisi sebelumnya
    }
    if (sc > bestScore) {
      bestScore = sc;
      best = c;
    }
  }
  return { found: true, contrast: variance, ...best };
}
