// Fungsi murni untuk suara rekaman SonarID (dipakai di browser dan di skrip pembuat suara).
// Setiap kalimat diberi kunci tetap (hash FNV-1a 32-bit dari teks yang dinormalisasi), sehingga
// berkas suara cukup dinamai dengan kunci itu dan aplikasi dapat menemukannya tanpa daftar manual.

export function normalizeSentence(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function voiceKey(sentence) {
  const s = normalizeSentence(sentence);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// Pecah teks menjadi kalimat. Satu ucapan (misalnya saran perbaikan + "Mari ulangi.") diputar
// sebagai beberapa potongan kalimat berurutan.
export function splitSentences(text) {
  const t = normalizeSentence(text);
  if (!t) return [];
  const parts = t.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [t];
  return parts.map((p) => p.trim()).filter(Boolean);
}
