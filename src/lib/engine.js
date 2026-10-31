// Mesin keputusan: memilih SATU instruksi terpenting dari hasil analisis frame.
// Urutan prioritas: keberadaan objek, cahaya, jarak, posisi, kemiringan, lalu kestabilan.
// Semua posisi dan ukuran relatif terhadap bagian kamera yang terlihat di layar.

export const TARGETS = {
  // KTP: yang terpenting adalah kartu terlihat utuh dan cukup besar agar NIK terbaca,
  // bukan ukuran yang persis. Karena itu rentang ukuran dan toleransi posisi dibuat lebar.
  ktp: {
    sizeMin: 0.45, // lebar kartu minimal 45% lebar tampilan
    sizeMax: 0.97,
    minPx: 260, // lebar kartu minimal dalam piksel kamera asli, agar digit NIK cukup besar
    edge: 0.012, // kartu tidak boleh terpotong tepi tampilan
    centerTol: 0.22,
    maxAngle: 15,
    minLight: 55, // kecerahan rata-rata KARTU (bukan seluruh layar), 0-255
    searchDark: 45, // bila kartu belum terlihat: persentil 95 seluruh layar di bawah ini berarti gelap
    maxGlare: 0.04, // rasio titik pantulan setempat pada kartu
  },
  selfie: { sizeMin: 0.32, sizeMax: 0.62, centerTolX: 0.12, centerTolY: 0.14, maxYaw: 0.25, maxRoll: 12, maxTilt: 30, minLight: 55, searchDark: 55 },
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function cardCut(m, e) {
  const b = m.bbox;
  if (!b) return { l: false, r: false, t: false, b: false };
  return { l: b.x < e, r: b.x + b.w > 1 - e, t: b.y < e, b: b.y + b.h > 1 - e };
}

// Instruksi KTP. Kunci arah selalu menggambarkan letak kartu di gambar:
//   kiri/kanan  = kartu perlu bergeser ke tengah dari sisi kiri/kanan gambar,
//   atas/bawah  = kartu berada di bagian atas/bawah gambar,
//   dekatkan/jauhkan, putar_kanan (searah jarum jam), putar_kiri, putar_tegak.
// Kalimat yang diucapkan disesuaikan dengan jenis kamera di messages.js
// (kamera belakang ponsel: "geser ponsel"; webcam laptop: "geser KTP").
// err: seberapa jauh dari kondisi tepat (dipakai untuk memberi pujian "terus" saat membaik).
// small: penyimpangan kecil, sehingga cukup diucapkan "sedikit".
function decideKtp(t, m, slack, base) {
  const r = (key, extra = {}) => ({ ...base, key, ok: false, small: false, err: 1, ...extra });
  if (m.light !== undefined && m.light < t.minLight / (slack > 1 ? 1.15 : 1)) return r('gelap');
  if (m.glare !== undefined && m.glare > t.maxGlare * slack) return r('silau');

  const b = m.bbox || { x: 0, y: 0, w: 1, h: 1 };
  const cut = cardCut(m, t.edge / slack);
  // Terpotong di dua sisi berlawanan, terlalu besar, atau terpotong satu sisi padahal sudah hampir selebar layar.
  if (
    (cut.l && cut.r) ||
    (cut.t && cut.b) ||
    m.size > t.sizeMax * slack ||
    ((cut.l || cut.r) && b.w > 0.85) ||
    ((cut.t || cut.b) && b.h > 0.85)
  ) {
    return r('jauhkan', { err: Math.max(m.size - t.sizeMax, b.w - 0.85, 0.05), small: m.size < t.sizeMax + 0.06 });
  }
  // Terpotong di satu sisi: geser ke arah sisi itu.
  if (cut.l || cut.r) return r(cut.l ? 'kiri' : 'kanan', { err: Math.abs(m.cx - 0.5) });
  if (cut.t || cut.b) return r(cut.t ? 'atas' : 'bawah', { err: Math.abs(m.cy - 0.5) });

  const needPx = m.px !== undefined ? t.minPx / slack : 0;
  const sizeMin = t.sizeMin / slack;
  if (m.size < sizeMin || (m.px !== undefined && m.px < needPx)) {
    const gap = Math.max(sizeMin - m.size, m.px !== undefined ? (needPx - m.px) / Math.max(1, m.px / m.size) : 0);
    return r('dekatkan', { err: gap, small: gap < 0.08 });
  }

  const tol = t.centerTol * slack;
  const offX = m.cx - 0.5;
  const offY = m.cy - 0.5;
  const exX = Math.abs(offX) - tol;
  const exY = Math.abs(offY) - tol;
  if (exX > 0 || exY > 0) {
    if (exX >= exY) return r(offX < 0 ? 'kiri' : 'kanan', { err: Math.abs(offX), small: exX < 0.1 });
    return r(offY < 0 ? 'atas' : 'bawah', { err: Math.abs(offY), small: exY < 0.1 });
  }

  const ang = m.angle || 0; // derajat, positif = kartu terlihat berputar searah jarum jam
  const a = Math.abs(ang);
  if (a > 45) return r('putar_tegak', { err: 90 - a });
  if (a > t.maxAngle * slack) return r(ang > 0 ? 'putar_kanan' : 'putar_kiri', { err: a / 90, small: a < 25 });

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
export function decide(mode, m, prevOk = false, opts = {}) {
  const t = TARGETS[mode];
  const slack = prevOk ? 1.35 : 1; // toleransi lebih longgar untuk tetap dianggap tepat
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
    const lo = t.sizeMin;
    const hi = 0.8; // rentang jarak nyaman untuk nada
    const mid = (lo + hi) / 2;
    const distErr = m.size >= lo && m.size <= hi ? 0 : clamp(Math.abs(m.size - mid) / mid, 0, 1);
    return decideKtp(t, m, slack, { found: true, moveX, moveY, distErr });
  }

  // Swafoto. Gambar kamera depan belum dicerminkan, sehingga arah kiri-kanan dibalik.
  const moveX = clamp(-offX * 2, -1, 1);
  const moveY = clamp(-offY * 2, -1, 1); // + berarti naikkan ponsel
  const mid = (t.sizeMin + t.sizeMax) / 2;
  const distErr = clamp(Math.abs(m.size - mid) / mid, 0, 1);
  return decideSelfie(t, m, slack, { found: true, moveX, moveY, distErr }, offX, offY, moveX, moveY);
}

// Apakah KTP sudah cukup terlihat untuk dibaca walaupun posisinya belum ideal
// (misalnya sedikit di luar tengah atau sedikit miring). Dipakai sebagai jalur cadangan
// agar foto tetap diambil otomatis dan pengguna tidak terus-menerus menyesuaikan posisi.
export function ktpReadable(m) {
  const t = TARGETS.ktp;
  if (!m || !m.found) return false;
  if (m.light !== undefined && m.light < t.minLight * 0.85) return false;
  if (m.glare !== undefined && m.glare > t.maxGlare * 2) return false;
  const cut = cardCut(m, 0.004);
  if (cut.l || cut.r || cut.t || cut.b) return false;
  if (m.size < t.sizeMin * 0.85) return false;
  if (m.px !== undefined && m.px < t.minPx * 0.9) return false;
  const a = Math.abs(m.angle || 0);
  if (a > 25 && a < 155) return false;
  return true;
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
