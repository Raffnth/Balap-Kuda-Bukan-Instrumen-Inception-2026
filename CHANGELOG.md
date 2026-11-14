# Finalist Changelog

Perubahan SonarID dari tag **`submission-24h`** (akhir Hacking Day) sampai **`finalist-release`**.
Semua perubahan termasuk kategori penyempurnaan yang diizinkan (perbaikan bug, stabilisasi, UI/UX, performa, keamanan dasar, dokumentasi, dan persiapan demo). **Substansi produk tidak berubah**: alur tetap foto KTP, swafoto, AI Quality Check, lalu penyerahan ke penyedia; tidak ada fitur inti baru.

## Ringkasan per masukan juri dan tim

| Masukan | Perubahan | Kategori |
|---|---|---|
| Deteksi KTP perlu lebih sensitif agar pemotretan lebih mudah | Jalur deteksi kedua berbasis warna biru KTP (meja putih, abu-abu, kayu kini terdeteksi); ukuran minimum kartu 38% → 33% lebar layar; jeda foto 0,4 → 0,3 detik | Perbaikan bug, UI/UX |
| Tulisan di layar terlambat dan berbeda dengan suara | Teks layar kini diambil dari kalimat yang sedang diucapkan dan diperbarui seketika; jeda potong ucapan 600 → 250 ms; panah arah di layar; catatan "Bagus, terus"/"Kelewatan" ikut tampil | Perbaikan bug, UI/UX |
| Suara bergantung pada pengaturan TTS/logat ponsel | Suara pemandu AI (TTS neural bahasa Indonesia) direkam sekali menjadi 158 berkas MP3 dan diputar aplikasi; tanpa pengaturan ponsel; cadangan hanya suara id-ID | Stabilisasi, UI/UX |
| Keamanan belum ada | CSP, HSTS, Permissions-Policy, COOP/CORP, pemblokiran berkas sensitif, pembatasan metode HTTP; komponen AI disajikan dari situs sendiri dengan sidik SHA-256; sidik SHA-256 foto di laporan; penghapusan sesi otomatis | Keamanan dasar |
| Penyempurnaan lain | Uji unit dan CI, dokumentasi lengkap, mode luring untuk suara dan komponen AI | Stabilisasi, dokumentasi |

## Rincian perubahan

### Perbaikan bug dan UI/UX

| Berkas | Perubahan |
|---|---|
| `src/lib/vision/card.js` | Jalur deteksi warna ("kebiruan" = biru − merah, ambang Otsu) dicoba bila jalur kecerahan belum menemukan kartu yang jelas; kontras kecerahan rendah tidak lagi langsung dianggap "tidak ada kartu" |
| `src/lib/engine.js` | `sizeMin` KTP 0,38 → 0,33 (batas piksel NIK `minPx` tetap menjaga keterbacaan) |
| `src/components/Guide.jsx` | Teks layar = instruksi terakhir yang diucapkan; pembaruan layar seketika; panah arah (kiri, kanan, depan/naik, belakang/turun, dekat, jauh, putar); catatan "Bagus, terus"/"Kelewatan"; `KTP_HOLD_MS` 400 → 300; jeda potong ucapan KTP 600 → 250 ms dan swafoto 1200 → 700 ms; semua saran perbaikan diambil dari katalog kalimat |
| `src/lib/direction.js` (baru) | Pemetaan instruksi ke arah panah, sesuai jenis kamera |
| `src/lib/messages.js` | Katalog lengkap semua kalimat yang diucapkan (`PHRASES`, `RESULT_SENTENCES`, `ADVICE`, `allSpokenTexts`); anjuran "meja gelap" diganti "permukaan polos/meja" karena meja terang kini didukung |
| `src/components/Result.jsx` | Ringkasan hasil disusun dari kalimat tetap; `role="status"` dihapus agar tidak terdengar ganda bersama TalkBack |
| `src/components/Help.jsx`, `Provider.jsx`, `src/lib/useConfirmTap.js` | Kalimat dari katalog |
| `src/components/Home.jsx` | Status "Suara pemandu SonarID siap"; panduan pemasangan suara ponsel hanya muncul bila rekaman gagal dimuat; pemberitahuan sesi dihapus |
| `src/index.css` | Gaya panah arah, catatan instruksi, dan sidik; animasi dimatikan untuk `prefers-reduced-motion` |
| `public/kartu-uji.html` | Tombol cetak memakai skrip terpisah (sesuai CSP); anjuran meja diperbarui |

### Suara pemandu AI

| Berkas | Perubahan |
|---|---|
| `src/lib/voice-core.js` (baru) | Kunci kalimat (hash FNV-1a) dan pemecah kalimat, dipakai bersama oleh aplikasi dan skrip |
| `src/lib/feedback.js` | Pemutar rekaman per kalimat (Web Audio): unduh paralel, dekode awal, potong hening awal/akhir, antrean dan pemotongan ucapan, nada dilirihkan saat bicara; cadangan Web Speech hanya bila ada suara id-ID; peristiwa `sonarid:say` untuk pengujian |
| `src/main.jsx` | Memuat rekaman suara sejak aplikasi dibuka |
| `scripts/generate-voice.mjs` (baru) | Membuat MP3 untuk setiap kalimat dengan mesin `edge`, `edge-py`, `azure`, `google`, atau `dummy`; hanya membuat ulang kalimat yang berubah; `--check` untuk CI |
| `public/voice/` (baru) | 158 rekaman MP3 dan `manifest.json` |

### Keamanan dasar

| Berkas | Perubahan |
|---|---|
| `public/.htaccess` | CSP, HSTS, Permissions-Policy diperketat, Referrer-Policy `no-referrer`, COOP/CORP, pemblokiran berkas tersembunyi/cadangan/konfigurasi, hanya GET/HEAD/OPTIONS, jenis MIME untuk MP3/model, cache untuk rekaman dan komponen AI |
| `src/lib/vendor.js` (baru), `src/lib/vision/face.js`, `src/lib/vision/ocr.js` | MediaPipe dan Tesseract dimuat dari `/vendor` (situs sendiri) bila tersedia, CDN resmi sebagai cadangan otomatis; batas waktu agar sumber rusak tidak membuat OCR menunggu |
| `scripts/prepare-assets.mjs` (baru) | Menyiapkan `/vendor` dan `vendor.json` berisi sidik SHA-256 setiap berkas (otomatis sebelum build) |
| `src/lib/integrity.js` (baru) | Sidik SHA-256 foto saat lulus pemeriksaan (Web Crypto), dimuat dalam laporan ke penyedia |
| `src/App.jsx` | Foto dihapus saat kembali ke beranda; sesi dihapus bila aplikasi ditinggalkan lebih dari 5 menit, dengan pemberitahuan suara |
| `SECURITY.md` (baru) | Data yang ditangani, model ancaman, header, cara memeriksa |

### Stabilisasi, performa, dan pengujian

| Berkas | Perubahan |
|---|---|
| `public/sw.js` | Cache versi 3: halaman tetap utamakan jaringan; rekaman suara dan komponen AI cache lebih dulu (demo tetap jalan saat sinyal buruk); cache dibersihkan otomatis bila daftar berkas berubah |
| `tests/*.test.mjs` (baru) | 29 uji unit: deteksi KTP di 5 jenis permukaan, kelengkapan katalog suara, keputusan, panah, header keamanan, SHA-256 |
| `.github/workflows/ci.yml` (baru) | Uji, pemeriksaan rekaman suara, dan build pada setiap push |
| `.gitignore` | `public/vendor/` dan berkas rahasia `.env` |

### Dokumentasi

| Berkas | Perubahan |
|---|---|
| `README.md` | Instalasi, penggunaan, teknologi, kontribusi tim, AI Use Declaration (termasuk suara AI), Third-Party Declaration, keterbatasan |
| `CHANGELOG.md` (baru) | Berkas ini |
| `docs/EVALUASI.md` (baru) | Metode dan hasil pengujian versi lama dan baru |

## Yang sengaja tidak diubah

| Ide | Alasan |
|---|---|
| Deteksi keaslian wajah (liveness) | Mengubah substansi produk dan bukan peran SonarID; keputusan verifikasi tetap milik penyedia |
| Pemeriksaan mata terbuka | Dapat menolak pengguna tunanetra yang matanya tertutup atau memakai mata palsu |
| Model bahasa besar di dalam produk | Panduan harus seketika dan foto tidak boleh keluar perangkat |
