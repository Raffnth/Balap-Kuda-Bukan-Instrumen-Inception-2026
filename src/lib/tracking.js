// Penyaring hasil deteksi KTP agar instruksi tidak berganti-ganti karena satu frame yang keliru.
// - MedianTracker: nilai posisi, ukuran, cahaya, dan silau diambil dari MEDIAN beberapa frame terakhir.
// - KeyVoter: instruksi yang disampaikan adalah instruksi yang paling sering muncul akhir-akhir ini.

const median = (arr) => {
  if (!arr.length) return undefined;
  const s = [...arr].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export class MedianTracker {
  constructor(windowMs = 500, minFoundRatio = 0.5) {
    this.windowMs = windowMs;
    this.minFoundRatio = minFoundRatio;
    this.hist = [];
    this.last = null; // hasil tersaring terakhir yang ditemukan
  }

  reset() {
    this.hist = [];
    this.last = null;
  }

  // Posisi acuan untuk detectCard (agar kandidat tidak melompat).
  get anchor() {
    return this.last ? { cx: this.last.cx, cy: this.last.cy } : null;
  }

  push(m, now) {
    this.hist.push({ t: now, m });
    while (this.hist.length && now - this.hist[0].t > this.windowMs) this.hist.shift();
    const all = this.hist.map((h) => h.m);
    const found = all.filter((x) => x.found);
    const frameP95 = median(all.map((x) => x.frameP95).filter((v) => v !== undefined));
    if (!found.length || found.length / all.length < this.minFoundRatio) {
      if (!found.length) this.last = null;
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
      frameP95,
      bbox: { x: x1, y: y1, w: x2 - x1, h: y2 - y1 },
      stability: found.length / all.length,
    };
    this.last = out;
    return out;
  }
}

function pick2(found, f) {
  return median(found.filter((x) => x.bbox).map((x) => f(x.bbox)));
}

export class KeyVoter {
  constructor(windowMs = 600) {
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
