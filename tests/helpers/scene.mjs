// Pembuat gambar uji sintetis (tanpa kamera dan tanpa KTP asli): kartu biru muda berisi "teks" gelap
// dan "foto", diletakkan di atas berbagai permukaan meja. Semua data fiktif.

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const SURFACES = {
  dark: (x, y, r) => [28 + r() * 8, 30 + r() * 8, 34 + r() * 8],
  white: (x, y, r) => [236 + r() * 6, 236 + r() * 6, 233 + r() * 6],
  gray: (x, y, r) => [178 + r() * 8, 178 + r() * 8, 176 + r() * 8],
  wood: (x, y, r) => {
    const g = Math.sin(y * 0.35 + Math.sin(x * 0.05) * 3) * 12;
    return [196 + g + r() * 6, 150 + g + r() * 6, 104 + g * 0.6 + r() * 6];
  },
  lightwood: (x, y, r) => {
    const g = Math.sin(y * 0.3 + Math.sin(x * 0.04) * 2) * 8;
    return [226 + g + r() * 5, 200 + g + r() * 5, 160 + g + r() * 5];
  },
};

// card: { cx, cy, w (lebar relatif lebar gambar), angle (derajat), text (default true) } atau null.
export function scene({ W = 192, H = 256, surface = 'dark', card = null, seed = 7, warm = 0 } = {}) {
  const r = rng(seed);
  const data = new Uint8ClampedArray(W * H * 4);
  const bg = SURFACES[surface];
  const ratio = 85.6 / 53.98;
  let cw = 0;
  let ch = 0;
  let cos = 1;
  let sin = 0;
  if (card) {
    cw = card.w * W;
    ch = cw / ratio;
    const a = ((card.angle || 0) * Math.PI) / 180;
    cos = Math.cos(a);
    sin = Math.sin(a);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let c = bg(x, y, r);
      if (card) {
        const dx = x - card.cx * W;
        const dy = y - card.cy * H;
        const u = (dx * cos + dy * sin) / cw + 0.5;
        const v = (-dx * sin + dy * cos) / ch + 0.5;
        if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
          c = [214 - 23 * u + r() * 4, 238 - 11 * v + r() * 4, 248 - 6 * u + r() * 4]; // biru muda bergradasi
          const text = card.text !== false;
          const line = (v0, v1, u0, u1) => v >= v0 && v <= v1 && u >= u0 && u <= u1 && Math.floor(u * 60) % 3 !== 0;
          if (text && (line(0.06, 0.13, 0.25, 0.75) || line(0.2, 0.3, 0.06, 0.62) || line(0.38, 0.43, 0.06, 0.55) ||
            line(0.5, 0.55, 0.06, 0.5) || line(0.62, 0.67, 0.06, 0.58) || line(0.74, 0.79, 0.06, 0.45))) {
            c = [40, 44, 52];
          }
          if (text && u >= 0.72 && u <= 0.94 && v >= 0.38 && v <= 0.88) c = [125, 106, 92];
        }
      }
      // Cahaya hangat (lampu kuning): tambah merah, kurangi biru.
      const i = (y * W + x) * 4;
      data[i] = c[0] + warm;
      data[i + 1] = c[1] + warm * 0.3;
      data[i + 2] = c[2] - warm;
      data[i + 3] = 255;
    }
  }
  return { data, width: W, height: H };
}
