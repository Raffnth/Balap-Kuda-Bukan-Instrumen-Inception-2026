// Kalimat suara SonarID dalam bahasa Indonesia.
// Tiga tingkat detail: lengkap, ringkas, dan nada (nada saja: instruksi arah tidak diucapkan).

export const DETAIL_LEVELS = [
  { id: 'lengkap', label: 'Lengkap', hint: 'Kalimat penuh, cocok untuk pengguna baru' },
  { id: 'ringkas', label: 'Ringkas', hint: 'Kata kunci singkat, cocok untuk pengguna terbiasa' },
  { id: 'nada', label: 'Nada saja', hint: 'Arah ditunjukkan nada, suara hanya untuk peristiwa penting' },
];

// Instruksi arah selama panduan (diucapkan pada level lengkap dan ringkas).
const GUIDE = {
  cari_ktp: {
    lengkap: 'KTP belum terlihat. Letakkan KTP di atas permukaan gelap, lalu arahkan kamera ke KTP.',
    ringkas: 'KTP belum terlihat.',
  },
  cari_wajah: {
    lengkap: 'Wajah belum terlihat. Pegang ponsel setinggi wajah, layar menghadap Anda.',
    ringkas: 'Wajah belum terlihat.',
  },
  gelap: { lengkap: 'Terlalu gelap. Hadapkan ke cahaya.', ringkas: 'Terlalu gelap.' },
  silau: { lengkap: 'Ada silau. Miringkan KTP sedikit.', ringkas: 'Ada silau.' },
  dekatkan: { lengkap: 'Dekatkan ponsel.', ringkas: 'Dekatkan.' },
  jauhkan: { lengkap: 'Jauhkan ponsel.', ringkas: 'Jauhkan.' },
  kiri: { lengkap: 'Geser ponsel ke kiri.', ringkas: 'Kiri.' },
  kanan: { lengkap: 'Geser ponsel ke kanan.', ringkas: 'Kanan.' },
  atas: { lengkap: 'Naikkan ponsel sedikit.', ringkas: 'Naik.' },
  bawah: { lengkap: 'Turunkan ponsel sedikit.', ringkas: 'Turun.' },
  luruskan: { lengkap: 'KTP miring. Luruskan posisi KTP.', ringkas: 'Luruskan.' },
  tegakkan: { lengkap: 'Tegakkan ponsel.', ringkas: 'Tegakkan.' },
  hadap: { lengkap: 'Hadapkan wajah lurus ke kamera.', ringkas: 'Hadap lurus.' },
  buram: { lengkap: 'Gambar belum tajam. Tahan ponsel tetap diam.', ringkas: 'Tahan diam.' },
  tahan: { lengkap: 'Hampir tepat. Tahan.', ringkas: 'Tahan.' },
};

// Teks yang ditampilkan di layar (singkat, untuk pengguna yang masih bisa melihat).
export const SCREEN_TEXT = {
  cari_ktp: 'Arahkan kamera ke KTP',
  cari_wajah: 'Arahkan kamera ke wajah',
  gelap: 'Terlalu gelap',
  silau: 'Ada silau pada KTP',
  dekatkan: 'Dekatkan ponsel',
  jauhkan: 'Jauhkan ponsel',
  kiri: 'Geser ke kiri',
  kanan: 'Geser ke kanan',
  atas: 'Naikkan ponsel',
  bawah: 'Turunkan ponsel',
  luruskan: 'Luruskan KTP',
  tegakkan: 'Tegakkan ponsel',
  hadap: 'Hadap lurus ke kamera',
  buram: 'Tahan ponsel tetap diam',
  tahan: 'Hampir tepat, tahan',
};

export function guideText(key, level) {
  const entry = GUIDE[key];
  if (!entry || level === 'nada') return null;
  return entry[level] || entry.lengkap;
}

// ---------------------------------------------------------------------------
// Instruksi khusus foto KTP, dibedakan menurut kamera:
// - rear : kamera belakang ponsel, KTP di meja dan ponsel yang digerakkan (pengguna sebenarnya).
// - front: webcam laptop/kamera depan, KTP yang digerakkan di depan kamera (uji coba di laptop).
// Kunci arah menggambarkan letak kartu di gambar (lihat engine.js), lalu diterjemahkan
// menjadi gerakan yang benar untuk masing-masing kamera.
const KTP_GUIDE = {
  rear: {
    cari_ktp: {
      lengkap: 'KTP belum terlihat. Letakkan KTP di meja berwarna gelap, lalu pegang ponsel mendatar sekitar satu jengkal di atasnya.',
      ringkas: 'KTP belum terlihat.',
    },
    gelap: { lengkap: 'Terlalu gelap. Nyalakan lampu atau pindah ke dekat jendela.', ringkas: 'Terlalu gelap.' },
    gelap_lagi: { lengkap: 'Masih terlalu gelap. Cari tempat yang lebih terang.', ringkas: 'Masih gelap.' },
    silau: { lengkap: 'Ada pantulan cahaya di KTP. Miringkan ponsel sedikit.', ringkas: 'Ada pantulan.' },
    kiri: { lengkap: 'Geser ponsel ke kiri.', ringkas: 'Kiri.', sedikit: 'Sedikit ke kiri.' },
    kanan: { lengkap: 'Geser ponsel ke kanan.', ringkas: 'Kanan.', sedikit: 'Sedikit ke kanan.' },
    atas: { lengkap: 'Geser ponsel ke depan, menjauhi badan.', ringkas: 'Maju.', sedikit: 'Sedikit ke depan.' },
    bawah: { lengkap: 'Geser ponsel ke belakang, mendekati badan.', ringkas: 'Mundur.', sedikit: 'Sedikit ke belakang.' },
    dekatkan: { lengkap: 'Turunkan ponsel, dekatkan ke KTP.', ringkas: 'Dekatkan.', sedikit: 'Sedikit lebih dekat.' },
    jauhkan: { lengkap: 'Angkat ponsel, jauhkan dari KTP.', ringkas: 'Jauhkan.', sedikit: 'Sedikit lebih jauh.' },
    putar_kanan: { lengkap: 'KTP miring. Putar ponsel sedikit searah jarum jam.', ringkas: 'Putar ke kanan.' },
    putar_kiri: { lengkap: 'KTP miring. Putar ponsel sedikit berlawanan arah jarum jam.', ringkas: 'Putar ke kiri.' },
    putar_tegak: { lengkap: 'KTP dan ponsel belum sejajar. Putar ponsel seperempat putaran.', ringkas: 'Putar seperempat.' },
    tahan: { lengkap: 'Posisi tepat. Tahan sebentar.', ringkas: 'Tahan.' },
  },
  front: {
    cari_ktp: {
      lengkap: 'KTP belum terlihat. Pegang KTP di depan kamera, dengan latar belakang gelap.',
      ringkas: 'KTP belum terlihat.',
    },
    gelap: { lengkap: 'Terlalu gelap. Nyalakan lampu atau hadapkan KTP ke cahaya.', ringkas: 'Terlalu gelap.' },
    gelap_lagi: { lengkap: 'Masih terlalu gelap. Cari tempat yang lebih terang.', ringkas: 'Masih gelap.' },
    silau: { lengkap: 'Ada pantulan cahaya di KTP. Miringkan KTP sedikit.', ringkas: 'Ada pantulan.' },
    kiri: { lengkap: 'Geser KTP ke kiri.', ringkas: 'Kiri.', sedikit: 'Sedikit ke kiri.' },
    kanan: { lengkap: 'Geser KTP ke kanan.', ringkas: 'Kanan.', sedikit: 'Sedikit ke kanan.' },
    atas: { lengkap: 'Turunkan KTP.', ringkas: 'Turun.', sedikit: 'Turunkan sedikit.' },
    bawah: { lengkap: 'Naikkan KTP.', ringkas: 'Naik.', sedikit: 'Naikkan sedikit.' },
    dekatkan: { lengkap: 'Dekatkan KTP ke kamera.', ringkas: 'Dekatkan.', sedikit: 'Sedikit lebih dekat.' },
    jauhkan: { lengkap: 'Jauhkan KTP dari kamera.', ringkas: 'Jauhkan.', sedikit: 'Sedikit lebih jauh.' },
    putar_kanan: { lengkap: 'KTP miring. Putar KTP sedikit searah jarum jam.', ringkas: 'Putar ke kanan.' },
    putar_kiri: { lengkap: 'KTP miring. Putar KTP sedikit berlawanan arah jarum jam.', ringkas: 'Putar ke kiri.' },
    putar_tegak: { lengkap: 'KTP tegak. Putar KTP seperempat putaran hingga mendatar.', ringkas: 'Putar seperempat.' },
    tahan: { lengkap: 'Posisi tepat. Tahan sebentar.', ringkas: 'Tahan.' },
  },
};

const KTP_SCREEN = {
  rear: {
    cari_ktp: 'Arahkan kamera ke KTP',
    gelap: 'Terlalu gelap',
    silau: 'Ada pantulan cahaya',
    kiri: 'Geser ponsel ke kiri',
    kanan: 'Geser ponsel ke kanan',
    atas: 'Geser ponsel ke depan',
    bawah: 'Geser ponsel ke belakang',
    dekatkan: 'Dekatkan ponsel ke KTP',
    jauhkan: 'Jauhkan ponsel dari KTP',
    putar_kanan: 'Putar searah jarum jam',
    putar_kiri: 'Putar berlawanan jarum jam',
    putar_tegak: 'Putar seperempat putaran',
    tahan: 'Posisi tepat, tahan',
  },
  front: {
    cari_ktp: 'Tunjukkan KTP ke kamera',
    gelap: 'Terlalu gelap',
    silau: 'Ada pantulan cahaya',
    kiri: 'Geser KTP ke kiri',
    kanan: 'Geser KTP ke kanan',
    atas: 'Turunkan KTP',
    bawah: 'Naikkan KTP',
    dekatkan: 'Dekatkan KTP ke kamera',
    jauhkan: 'Jauhkan KTP dari kamera',
    putar_kanan: 'Putar KTP searah jarum jam',
    putar_kiri: 'Putar KTP berlawanan jarum jam',
    putar_tegak: 'Putar KTP seperempat putaran',
    tahan: 'Posisi tepat, tahan',
  },
};

export const KTP_EXTRA = {
  terus: { lengkap: 'Bagus, terus.', ringkas: 'Terus.' },
  kelewatan: { lengkap: 'Kelewatan.', ringkas: 'Lewat.' },
};

// Kalimat instruksi KTP. again=true untuk pengulangan (misalnya "Masih terlalu gelap").
export function ktpGuideText(key, level, cam, { small = false, again = false } = {}) {
  if (level === 'nada') return null;
  const set = KTP_GUIDE[cam === 'front' ? 'front' : 'rear'];
  const entry = (key === 'gelap' && again && set.gelap_lagi) || set[key];
  if (!entry) return null;
  if (small && entry.sedikit) return entry.sedikit;
  return entry[level] || entry.lengkap;
}

export function ktpScreenText(key, cam) {
  return KTP_SCREEN[cam === 'front' ? 'front' : 'rear'][key] || null;
}

export function extraText(key, level) {
  const e = KTP_EXTRA[key];
  return e ? e[level] || e.lengkap : '';
}

// Kalimat peristiwa penting (diucapkan di semua level, termasuk "nada saja").
export const EVENTS = {
  welcome: 'SonarID. Panduan suara untuk memotret KTP dan wajah. Ketuk di mana saja untuk mulai.',
  welcomeNonVisual:
    'Mode uji non visual aktif. Layar akan gelap. Ketuk di mana saja untuk mulai.',
  startKtp: {
    lengkap:
      'Langkah pertama, foto KTP. Gunakan kamera belakang. Letakkan KTP di atas permukaan gelap, lalu arahkan ponsel ke KTP. Ikuti suara dan nada.',
    ringkas: 'Foto KTP. Arahkan kamera belakang ke KTP.',
    nada: 'Foto KTP. Ikuti nada.',
  },
  startKtpFront: {
    lengkap:
      'Langkah pertama, foto KTP. Pegang KTP di depan kamera dengan latar belakang gelap. Ikuti suara dan nada.',
    ringkas: 'Foto KTP. Tunjukkan KTP ke kamera.',
    nada: 'Foto KTP. Ikuti nada.',
  },
  startSelfie: {
    lengkap:
      'Langkah kedua, swafoto. Balik ponsel sehingga layar menghadap wajah Anda, pegang setinggi wajah, lalu ikuti suara dan nada.',
    ringkas: 'Swafoto. Arahkan layar ke wajah.',
    nada: 'Swafoto. Ikuti nada.',
  },
  lightOk: 'Cahaya cukup.',
  lightLow: 'Cahaya kurang. Sebaiknya pindah ke tempat yang lebih terang.',
  capturedKtp: 'Foto KTP diambil. Memeriksa kualitas.',
  capturedSelfie: 'Swafoto diambil. Memeriksa kualitas.',
  ktpOk: 'Foto KTP berhasil. NIK terbaca dan foto tajam.',
  selfieOk: 'Swafoto berhasil. Wajah terlihat jelas.',
  retry: 'Mari ulangi.',
  helpOffer:
    'Foto belum berhasil beberapa kali. Anda dapat meminta bantuan petugas tanpa mengulang dari awal.',
  sent: 'Foto dan laporan kualitas sudah diterima penyedia layanan. Terima kasih.',
  cameraError:
    'Kamera tidak dapat dibuka. Pastikan izin kamera diberikan untuk situs ini, lalu coba lagi.',
  modelError:
    'Komponen pengenal wajah gagal dimuat. Periksa koneksi internet, lalu coba lagi.',
};

export function eventText(key, level) {
  const entry = EVENTS[key];
  if (typeof entry === 'string') return entry;
  return entry[level] || entry.lengkap;
}
