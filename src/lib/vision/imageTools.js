// Alat pengolahan citra ringan (tanpa pustaka luar) untuk menilai kualitas foto.

// Mengubah RGBA menjadi luminans 0..255.
export function toGray(data, w, h) {
  const out = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; j < out.length; i += 4, j++) {
    out[j] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
  }
  return out;
}

const fullRect = (w, h) => ({ x: 0, y: 0, w, h });

function clampRect(r, w, h) {
  const x = Math.max(0, Math.floor(r.x));
  const y = Math.max(0, Math.floor(r.y));
  const x2 = Math.min(w, Math.ceil(r.x + r.w));
  const y2 = Math.min(h, Math.ceil(r.y + r.h));
  return { x, y, w: Math.max(0, x2 - x), h: Math.max(0, y2 - y) };
}

// Rata-rata kecerahan (0..255).
export function meanBrightness(gray, w, h, rect = fullRect(w, h)) {
  const r = clampRect(rect, w, h);
  if (!r.w || !r.h) return 0;
  let sum = 0;
  for (let y = r.y; y < r.y + r.h; y++) {
    const row = y * w;
    for (let x = r.x; x < r.x + r.w; x++) sum += gray[row + x];
  }
  return sum / (r.w * r.h);
}

// Ketajaman: variansi Laplacian (makin besar makin tajam).
export function sharpness(gray, w, h, rect = fullRect(w, h)) {
  const r = clampRect(rect, w, h);
  const x0 = Math.max(1, r.x);
  const y0 = Math.max(1, r.y);
  const x1 = Math.min(w - 1, r.x + r.w);
  const y1 = Math.min(h - 1, r.y + r.h);
  let n = 0;
  let sum = 0;
  let sumSq = 0;
  for (let y = y0; y < y1; y++) {
    const row = y * w;
    for (let x = x0; x < x1; x++) {
      const i = row + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (!n) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

// Statistik cahaya dalam satu langkah: rata-rata, median, persentil 95, rasio titik silau, dan rasio jenuh.
// Titik silau = piksel yang jauh lebih terang daripada warna dasar kartu: ambang = maks(248, persentil60 + 25).
// Persentil 60 mewakili warna dasar kartu (bukan teks, foto, atau pantulan), sehingga kartu yang terang
// merata atau agak terlalu terang (misalnya kartu uji di layar laptop) tidak dianggap silau; yang dihitung
// hanya pantulan setempat. saturated = rasio piksel hampir putih (>= 250) apa adanya.
export function lightStats(gray, w, h, rect = fullRect(w, h)) {
  const r = clampRect(rect, w, h);
  const n = r.w * r.h;
  if (!n) return { mean: 0, median: 0, p95: 0, glare: 0, saturated: 0 };
  const hist = new Uint32Array(256);
  let sum = 0;
  for (let y = r.y; y < r.y + r.h; y++) {
    const row = y * w;
    for (let x = r.x; x < r.x + r.w; x++) {
      const v = gray[row + x];
      hist[v]++;
      sum += v;
    }
  }
  const at = (q) => {
    const target = q * n;
    let acc = 0;
    for (let i = 0; i < 256; i++) {
      acc += hist[i];
      if (acc >= target) return i;
    }
    return 255;
  };
  const median = at(0.5);
  const p95 = at(0.95);
  const thr = Math.max(248, at(0.6) + 25);
  let hot = 0;
  for (let i = thr; i < 256; i++) hot += hist[i];
  let sat = 0;
  for (let i = 250; i < 256; i++) sat += hist[i];
  return { mean: sum / n, median, p95, glare: thr > 255 ? 0 : hot / n, saturated: sat / n };
}

// Proporsi piksel sangat terang (pantulan cahaya/silau).
export function glareRatio(gray, w, h, rect = fullRect(w, h), threshold = 250) {
  const r = clampRect(rect, w, h);
  if (!r.w || !r.h) return 0;
  let count = 0;
  for (let y = r.y; y < r.y + r.h; y++) {
    const row = y * w;
    for (let x = r.x; x < r.x + r.w; x++) if (gray[row + x] >= threshold) count++;
  }
  return count / (r.w * r.h);
}

// Bagian frame kamera yang benar-benar terlihat di layar.
// Video ditampilkan dengan object-fit: cover, sehingga sebagian frame terpotong bila rasio
// kamera berbeda dengan kotak tampilan (misalnya webcam laptop 16:9 di kotak 3:4).
// Analisis memakai bagian yang terlihat saja agar posisi dan ukuran sesuai dengan bingkai di layar.
// Mengembalikan { sx, sy, sw, sh } dalam piksel sumber.
export function visibleCrop(source, boxW, boxH) {
  const sw = source.videoWidth || source.width || 0;
  const sh = source.videoHeight || source.height || 0;
  if (!sw || !sh) return null;
  if (!boxW || !boxH) return { sx: 0, sy: 0, sw, sh };
  const srcRatio = sw / sh;
  const boxRatio = boxW / boxH;
  if (srcRatio > boxRatio) {
    const w = Math.round(sh * boxRatio);
    return { sx: Math.round((sw - w) / 2), sy: 0, sw: w, sh };
  }
  const h = Math.round(sw / boxRatio);
  return { sx: 0, sy: Math.round((sh - h) / 2), sw, sh: h };
}

function sourceRect(source, crop) {
  const sw = source.videoWidth || source.width || 0;
  const sh = source.videoHeight || source.height || 0;
  if (!sw || !sh) return null;
  return crop && crop.sw > 0 && crop.sh > 0 ? crop : { sx: 0, sy: 0, sw, sh };
}

// Menggambar sumber (video/canvas) ke canvas berukuran tertentu dan mengembalikan ImageData.
// crop (opsional): bagian sumber yang dianalisis, hasil visibleCrop.
export function grabFrame(source, canvas, targetW, crop) {
  const r = sourceRect(source, crop);
  if (!r) return null;
  const w = Math.max(1, Math.round(targetW));
  const h = Math.max(1, Math.round((r.sh / r.sw) * w));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, r.sx, r.sy, r.sw, r.sh, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

// Ambil foto resolusi penuh dari video (hanya bagian crop bila diberikan). Mengembalikan canvas.
export function captureFull(video, maxW = 1600, crop) {
  const r = sourceRect(video, crop);
  const scale = Math.min(1, maxW / r.sw);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(r.sw * scale));
  c.height = Math.max(1, Math.round(r.sh * scale));
  c.getContext('2d').drawImage(video, r.sx, r.sy, r.sw, r.sh, 0, 0, c.width, c.height);
  return c;
}

// Potong area tertentu dari canvas (koordinat dalam piksel), opsional diperbesar dan diputar 180 derajat.
export function cropCanvas(src, rect, { scale = 1, rotate180 = false } = {}) {
  const r = clampRect(rect, src.width, src.height);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(r.w * scale));
  c.height = Math.max(1, Math.round(r.h * scale));
  const ctx = c.getContext('2d');
  if (rotate180) {
    ctx.translate(c.width, c.height);
    ctx.rotate(Math.PI);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
  return c;
}

// Ubah canvas menjadi hitam-putih kontras tinggi (membantu OCR).
export function binarize(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gray = toGray(img.data, canvas.width, canvas.height);
  const t = otsuThreshold(gray);
  for (let i = 0, j = 0; j < gray.length; i += 4, j++) {
    const v = gray[j] > t ? 255 : 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Filter maksimum/minimum 1 dimensi dengan antrean monoton (waktu linear), per baris atau per kolom.
function minMaxFilter(src, dst, w, h, r, isMax, horizontal) {
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const step = horizontal ? 1 : w;
  const idx = new Int32Array(len);
  for (let line = 0; line < lines; line++) {
    const base = horizontal ? line * w : line;
    let head = 0;
    let tail = 0;
    let j = 0;
    for (let i = 0; i < len; i++) {
      const hi = Math.min(len - 1, i + r);
      while (j <= hi) {
        const v = src[base + j * step];
        while (tail > head) {
          const last = src[base + idx[tail - 1] * step];
          if (isMax ? last <= v : last >= v) tail--;
          else break;
        }
        idx[tail++] = j;
        j++;
      }
      while (idx[head] < i - r) head++;
      dst[base + i * step] = src[base + idx[head] * step];
    }
  }
}

// Hitam-putih dengan koreksi cahaya tidak merata (untuk OCR). Latar diperkirakan dengan operasi "closing"
// (maksimum lalu minimum lokal) yang menghapus goresan teks gelap namun mempertahankan batas bayangan.
// Piksel dianggap tinta bila lebih gelap dari 70% latar di sekitarnya. Dengan cara ini NIK tetap terbaca
// walaupun sebagian kartu tertutup bayangan ponsel atau terkena pita kedip layar.
export function normalizeBinarize(canvas, { radiusFrac = 0.06, ratio = 0.7 } = {}) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, w, h);
  const gray = toGray(img.data, w, h);
  const r = Math.max(3, Math.round(Math.min(w, h) * radiusFrac));
  const a = new Uint8ClampedArray(w * h);
  const b = new Uint8ClampedArray(w * h);
  minMaxFilter(gray, a, w, h, r, true, true);
  minMaxFilter(a, b, w, h, r, true, false);
  minMaxFilter(b, a, w, h, r, false, true);
  minMaxFilter(a, b, w, h, r, false, false); // b = perkiraan latar
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    const v = gray[p] < Math.max(1, b[p]) * ratio ? 0 : 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Ambang Otsu dan variansi antar-kelas (untuk menilai kontras).
export function otsuThreshold(gray, withVariance = false) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return withVariance ? { threshold, variance: best / (total * total) } : threshold;
}
