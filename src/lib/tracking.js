// Penyaring hasil deteksi KTP agar instruksi tidak berganti-ganti karena satu frame yang keliru.
// - MedianTracker: nilai posisi, ukuran, cahaya, dan silau diambil dari MEDIAN beberapa frame terakhir.
// - KeyVoter: instruksi yang disampaikan adalah instruksi yang paling sering muncul akhir-akhir ini.

const median = (arr) => {
  if (!arr.length) return undefined;
  const s = [...arr].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// Status "kartu terlihat" memakai histeresis: menjadi terlihat bila >= enterRatio frame dalam jendela
// menemukan kartu, dan baru dianggap hilang bila < exitRatio. Frame yang sesekali gagal (fokus kamera
// berburu, pita kedip layar, getaran) tidak membuat kartu dianggap hilang.
export class MedianTracker {
  constructor(windowMs = 300, enterRatio = 0.5, exitRatio = 0.25) {
    this.windowMs = windowMs;
    this.enterRatio = enterRatio;
    this.exitRatio = exitRatio;
    this.hist = [];
    this.last = null; // hasil tersaring terakhir yang ditemukan
    this.lastAt = 0;
    this.visible = false;
  }

  reset() {
    this.hist = [];
    this.last = null;
    this.lastAt = 0;
    this.visible = false;
  }

  // Posisi dan ukuran acuan untuk detectCard (agar kandidat tidak melompat, dan untuk mengenali
  // "terlalu dekat"). Diingat sampai 2 detik setelah kartu terakhir terlihat.
  anchorAt(now) {
    return this.last && now - this.lastAt < 2000 ? { cx: this.last.cx, cy: this.last.cy, size: this.last.size } : null;
  }

  push(m, now) {
    this.hist.push({ t: now, m });
    while (this.hist.length && now - this.hist[0].t > this.windowMs) this.hist.shift();
    const all = this.hist.map((h) => h.m);
    const found = all.filter((x) => x.found);
    const frameP95 = median(all.map((x) => x.frameP95).filter((v) => v !== undefined));
    const ratio = all.length ? found.length / all.length : 0;
    this.visible = found.length > 0 && ratio >= (this.visible ? this.exitRatio : this.enterRatio);
    if (!this.visible) {
      return { found: false, frameP95, light: frameP95 };
    }
    const pick = (k) => median(found.map((x) => x[k]).filter((v) => typeof v === 'number'));
    const x1 = pick2(found, (b) => b.x);
    const y1 = pick2(found, (b) => b.y);
    const x2 = pick2(found, (b) => b.x + b.w);
    const y2 = pick2(found, (b) => b.y + b.h);
    const latest = found[found.length - 1];
    const out = {
      ...latest,
      found: true,
      cx: pick('cx'),
      cy: pick('cy'),
      size: pick('size'),
      px: pick('px'),
      angle: pick('angle'),
      light: pick('light'),
      glare: pick('glare'),
      saturated: pick('saturated'),
      frameP95,
      bbox: { x: x1, y: y1, w: x2 - x1, h: y2 - y1 },
      stability: found.length / all.length,
      tooClose: found.filter((x) => x.tooClose).length * 2 >= found.length,
      partial: !!latest.partial,
    };
    this.last = out;
    this.lastAt = now;
    return out;
  }
}

function pick2(found, f) {
  return median(found.filter((x) => x.bbox).map((x) => f(x.bbox)));
}

export class KeyVoter {
  constructor(windowMs = 300) {
    this.windowMs = windowMs;
    this.reset();
  }

  reset() {
    this.hist = [];
    this.key = null;
    this.since = 0;
  }

  // Mengembalikan { key, since }: instruksi pemenang dan sejak kapan ia menang tanpa terputus.
  push(key, now) {
    this.hist.push({ t: now, key });
    while (this.hist.length && now - this.hist[0].t > this.windowMs) this.hist.shift();
    const score = new Map();
    for (const h of this.hist) {
      const w = 0.5 + 0.5 * (1 - (now - h.t) / this.windowMs); // frame terbaru sedikit lebih berbobot
      score.set(h.key, (score.get(h.key) || 0) + w);
    }
    let winner = key;
    let best = -1;
    for (const [k, v] of score) {
      if (v > best || (v === best && k === this.key)) {
        best = v;
        winner = k;
      }
    }
    if (winner !== this.key) {
      this.key = winner;
      this.since = now;
    }
    return { key: this.key, since: this.since };
  }
}
