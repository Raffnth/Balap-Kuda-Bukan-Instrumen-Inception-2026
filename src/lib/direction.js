// Panah di layar yang artinya sama dengan kalimat instruksi yang diucapkan
// (untuk pendamping atau pengguna low vision). Contoh: kamera belakang "Geser ponsel ke depan" = panah ke atas;
// webcam "Turunkan KTP" = panah ke bawah. Nilai: left, right, up, down, in (dekatkan), out (jauhkan),
// cw (putar searah jarum jam), ccw (berlawanan jarum jam), atau null (tanpa panah).
export function arrowFor(key, isKtp, cam) {
  const front = isKtp && cam === 'front';
  switch (key) {
    case 'kiri':
      return 'left';
    case 'kanan':
      return 'right';
    case 'atas':
      return front ? 'down' : 'up';
    case 'bawah':
      return front ? 'up' : 'down';
    case 'dekatkan':
      return 'in';
    case 'jauhkan':
      return 'out';
    case 'putar_kanan':
    case 'putar_tegak':
      return 'cw';
    case 'putar_kiri':
      return 'ccw';
    default:
      return null;
  }
}
