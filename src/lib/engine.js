// Mesin keputusan: memilih SATU instruksi terpenting dari hasil analisis frame.
// Urutan prioritas: keberadaan objek, cahaya, jarak, posisi, kemiringan, lalu kestabilan.
// Semua posisi dan ukuran relatif terhadap bagian kamera yang terlihat di layar.

export const TARGETS = {
  // KTP: foto diambil SEGERA setelah kartu terlihat utuh dan cukup besar untuk dibaca.
  // Kartu tidak harus di tengah atau lurus sempurna: kemiringan diluruskan sebelum OCR, dan
  // kelayakan akhir ditentukan oleh terbacanya NIK (lihat Guide.jsx, checkKtp).
  ktp: {
    sizeMin: 0.38, // lebar kartu minimal 38% lebar tampilan
    minPx: 250, // lebar kartu minimal dalam piksel kamera asli, agar digit NIK cukup besar (teruji OCR)
    edge: 0.01, // kartu harus utuh, tidak terpotong tepi tampilan
    maxAngle: 30, // kemiringan sampai 30 derajat masih diluruskan otomatis sebelum OCR
    minLight: 45, // kecerahan rata-rata KARTU (bukan seluruh layar), 0-255
    searchDark: 45, // bila kartu belum terlihat: persentil 95 seluruh layar di bawah ini berarti gelap
    maxGlare: 0.15, // hanya pantulan berat yang menahan foto; pantulan ringan diputuskan oleh OCR
    idealMin: 0.5, // rentang jarak nyaman untuk nada (lebar kartu relatif tampilan)
    idealMax: 0.8,
  },
  selfie: { sizeMin: 0.32, sizeMax: 0.62, centerTolX: 0.12, centerTolY: 0.14, maxYaw: 0.25, maxRoll: 12, maxTilt: 30, minLight: 55, searchDark: 55 },
};

// Ambang pantulan untuk catatan kualitas setelah foto diambil (bukan penahan foto).
export const GLARE_WARN = 0.04;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function cardCut(m, e) {
  const b = m.bbox;
  if (!b) return { l: false, r: false, t: false, b: false };
  return { l: b.x < e, r: b.x + b.w > 1 - e, t: b.y < e, b: b.y + b.h > 1 - e };
}

// Instruksi KTP. Kunci arah selalu menggambarkan letak kartu di gambar:
//   kiri/kanan  = kartu terpotong di sisi kiri/kanan gambar (geser ke arah itu),
//   atas/bawah  = kartu terpotong di bagian atas/bawah gambar,
//   dekatkan/jauhkan, putar_kanan (searah jarum jam), putar_kiri, putar_tegak.
// Kalimat yang diucapkan disesuaikan dengan jenis kamera di messages.js
// (kamera belakang ponsel: "geser ponsel"; webcam laptop: "geser KTP").
// Urutan: kartu utuh dulu (tidak terpotong, tidak terlalu dekat), lalu cukup besar, cukup terang,
// tidak silau berat, tidak terlalu miring. Bila semua terpenuhi: 'tahan' (ok) dan foto langsung diambil.
// err: seberapa jauh dari kondisi tepat (dipakai untuk memberi pujian "terus" saat membaik).
// small: penyimpangan kecil, sehingga cukup diucapkan "sedikit".
function decideKtp(t, m, slack, base, opts) {
  const r = (key, extra = {}) => ({ ...base, key, ok: false, small: false, err: 1, ...extra });
  if (m.tooClose) return r('jauhkan', { err: 0.3 });

  const b = m.bbox || { x: 0, y: 0, w: 1, h: 1 };
  const cut = cardCut(m, t.edge / slack);
  // Terpotong di dua sisi berlawanan, atau terpotong satu sisi padahal sudah hampir selebar layar: terlalu dekat.
  if ((cut.l && cut.r) || (cut.t && cut.b) || ((cut.l || cut.r) && b.w > 0.85) || ((cut.t || cut.b) && b.h > 0.85)) {
    return r('jauhkan', { err: Math.max(b.w - 0.85, 0.05), small: b.w < 0.95 });
  }
  // Terpotong di satu sisi: geser ke arah sisi itu. Bila kartu hanya sedikit keluar bingkai, cukup "sedikit".
  if (cut.l || cut.r) return r(cut.l ? 'kiri' : 'kanan', { err: Math.abs(m.cx - 0.5), small: !m.partial });
  if (cut.t || cut.b) return r(cut.t ? 'atas' : 'bawah', { err: Math.abs(m.cy - 0.5), small: !m.partial });

  const sizeMin = t.sizeMin / slack;
  const needPx = t.minPx / slack;
  if (m.size < sizeMin || (m.px !== undefined && m.px < needPx)) {
    const gap = Math.max(sizeMin - m.size, m.px !== undefined ? (needPx - m.px) / Math.max(1, m.px / m.size) : 0);
    return r('dekatkan', { err: gap, small: gap < 0.1 });
  }

  if (m.light !== undefined && m.light < t.minLight / slack) return r('gelap');
  const maxGlare = opts && typeof opts.maxGlare === 'number' ? opts.maxGlare : t.maxGlare;
  if (m.glare !== undefined && m.glare > maxGlare * slack) return r('silau');

  const ang = m.angle || 0; // derajat, positif = kartu terlihat berputar searah jarum jam
  const a = Math.abs(ang);
  if (a > 55) return r('putar_tegak', { err: 90 - a });
  if (a > t.maxAngle * slack) return r(ang > 0 ? 'putar_kanan' : 'putar_kiri', { err: a / 90, small: a < 40 });

  return { ...base, key: 'tahan', ok: true, small: false, err: 0 };
}

function decideSelfie(t, m, slack, base, offX, offY, moveX, moveY) {
  if (m.light !== undefined && m.light < t.minLight) return { ...base, key: 'gelap', ok: false };
  if (m.size < t.sizeMin / slack) return { ...base, key: 'dekatkan', ok: false };
  if (m.size > t.sizeMax * slack) return { ...base, key: 'jauhkan', ok: false };

  const tolX = t.centerTolX * slack;
  const tolY = t.centerTolY * slack;
  if (Math.abs(offX) > tolX || Math.abs(offY) > tolY) {
    // Sampaikan sumbu dengan penyimpangan terbesar lebih dulu.
    if (Math.abs(offX) / tolX >= Math.abs(offY) / tolY) {
      return { ...base, key: moveX < 0 ? 'kiri' : 'kanan', ok: false };
    }
    return { ...base, key: moveY > 0 ? 'atas' : 'bawah', ok: false };
  }

  if ((m.tilt !== undefined && Math.abs(m.tilt) > t.maxTilt) || Math.abs(m.roll) > t.maxRoll * slack) {
    return { ...base, key: 'tegakkan', ok: false };
  }
  if (Math.abs(m.yaw) > t.maxYaw * slack) return { ...base, key: 'hadap', ok: false };

  return { ...base, key: 'tahan', ok: true };
}

// m: hasil analisis frame (detectCard atau analyzeFace) ditambah { light, glare, tilt, px, frameP95 }.
// prevOk: apakah frame sebelumnya sudah "tepat" (histeresis agar status tidak berganti-ganti).
// opts.cam: 'rear' (kamera belakang ponsel) atau 'front' (webcam laptop/kamera depan), hanya untuk KTP.
// opts.maxGlare: batas pantulan khusus (lebih ketat setelah foto gagal karena pantulan).
export function decide(mode, m, prevOk = false, opts = {}) {
  const t = TARGETS[mode];
  // Toleransi lebih longgar untuk tetap dianggap tepat (histeresis), agar status tidak berganti-ganti.
  const slack = prevOk ? (mode === 'ktp' ? 1.2 : 1.35) : 1;
  if (!m || !m.found) {
    if (mode === 'ktp') {
      // Latar KTP memang dianjurkan gelap, jadi yang dinilai adalah bagian TERANG layar (persentil 95):
      // bila bagian paling terang pun redup, ruangan memang gelap.
      const p95 = m ? (m.frameP95 !== undefined ? m.frameP95 : m.light) : undefined;
      if (p95 !== undefined && p95 < t.searchDark) return { key: 'gelap', ok: false, found: false, err: 1 };
      return { key: 'cari_ktp', ok: false, found: false, err: 1 };
    }
    if (m && m.light !== undefined && m.light < t.searchDark) return { key: 'gelap', ok: false, found: false };
    return { key: 'cari_wajah', ok: false, found: false };
  }

  const offX = m.cx - 0.5; // + berarti objek di kanan gambar
  const offY = m.cy - 0.5; // + berarti objek di bawah gambar

  if (mode === 'ktp') {
    // Nada: arah stereo = arah gerak; nada tinggi = gerakkan ponsel ke depan (kamera belakang)
    // atau KTP ke atas (webcam). Pada webcam, KTP di atas gambar berarti KTP perlu diturunkan.
    const front = opts.cam === 'front';
    const moveX = clamp(offX * 2, -1, 1);
    const moveY = front ? clamp(offY * 2, -1, 1) : clamp(-offY * 2, -1, 1);
    const lo = t.idealMin;
    const hi = t.idealMax;
    const mid = (lo + hi) / 2;
    const distErr = m.size >= lo && m.size <= hi ? 0 : clamp(Math.abs(m.size - mid) / mid, 0, 1);
    return decideKtp(t, m, slack, { found: true, moveX, moveY, distErr }, opts);
  }

  // Swafoto. Gambar kamera depan belum dicerminkan, sehingga arah kiri-kanan dibalik.
  const moveX = clamp(-offX * 2, -1, 1);
  const moveY = clamp(-offY * 2, -1, 1); // + berarti naikkan ponsel
  const mid = (t.sizeMin + t.sizeMax) / 2;
  const distErr = clamp(Math.abs(m.size - mid) / mid, 0, 1);
  return decideSelfie(t, m, slack, { found: true, moveX, moveY, distErr }, offX, offY, moveX, moveY);
}

// Pelacak kestabilan berbasis akumulasi waktu.
// - Selama posisi tepat, progres bertambah; foto diambil saat progres mencapai 1 (sekitar holdMs).
// - Frame yang sesekali tidak tepat hanya MENGURANGI progres perlahan, tidak mengulang dari nol.
// - Progres diulang dari nol hanya bila objek melompat jauh atau posisi tidak tepat cukup lama.
// Dengan cara ini getaran tangan dan derau webcam tidak lagi menggagalkan foto otomatis.
export class Stabilizer {
  constructor(holdMs = 700, decayMs = 1400, jumpMax = 0.25, resetAfterMs = 1500) {
    this.holdMs = holdMs;
    this.decayMs = decayMs;
    this.jumpMax = jumpMax;
    this.resetAfterMs = resetAfterMs;
    this.reset();
  }

  reset() {
    this.progress = 0;
    this.last = 0;
    this.avg = null;
    this.badMs = 0;
  }

  // Mengembalikan progres 0..1; 1 berarti siap diambil.
  update(ok, m, now = performance.now()) {
    // Batasi selang waktu agar jeda panjang (tab disembunyikan, perangkat lambat) tidak melompatkan progres.
    const dt = this.last ? clamp(now - this.last, 0, 200) : 0;
    this.last = now;
    if (ok && m && m.found) {
      this.badMs = 0;
      if (this.avg && Math.hypot(m.cx - this.avg.cx, m.cy - this.avg.cy) > this.jumpMax) {
        this.progress = 0; // objek melompat jauh: hitung ulang
        this.avg = null;
      }
      this.avg = this.avg
        ? { cx: this.avg.cx + (m.cx - this.avg.cx) * 0.3, cy: this.avg.cy + (m.cy - this.avg.cy) * 0.3 }
        : { cx: m.cx, cy: m.cy };
      this.progress = Math.min(1, this.progress + dt / this.holdMs);
    } else {
      this.badMs += dt;
      this.progress = Math.max(0, this.progress - dt / this.decayMs);
      if (this.badMs > this.resetAfterMs) {
        this.progress = 0;
        this.avg = null;
      }
    }
    return this.progress;
  }
}
