# SonarID — eKYC Inklusif bagi Penyandang Tunanetra

SonarID adalah komponen web yang memandu penyandang tunanetra memotret **KTP** dan **swafoto** untuk proses eKYC secara mandiri melalui **suara, nada, dan getar**. Foto diambil otomatis saat posisi sudah tepat, lalu diperiksa kualitasnya (**AI Quality Check**) sebelum diserahkan ke penyedia layanan. Seluruh analisis berlangsung di perangkat pengguna.

Dibuat oleh tim **Balap Kuda Bukan Instrumen** (Politeknik Siber dan Sandi Negara) untuk **INCEPTION 2026** (Subtema: Health, Well-being & Accessibility). Versi ini adalah rilis **`finalist-release`**; perubahan sejak `submission-24h` tercatat di [CHANGELOG.md](CHANGELOG.md).

## Masalah dan solusi

| | |
|---|---|
| Masalah | eKYC mewajibkan foto KTP dan swafoto yang terbingkai rapi. Penyandang tunanetra tidak dapat melihat bingkai kamera, sehingga sering gagal verifikasi atau bergantung pada orang lain untuk data yang bersifat pribadi |
| Solusi | SonarID memandu lewat suara, nada stereo, dan getar, memotret otomatis saat KTP sudah terbaca, lalu memeriksa kualitas foto sebelum dikirim ke penyedia |
| Pengguna | Penyandang tunanetra dan low vision; juga lansia dan siapa pun yang kesulitan membingkai foto |
| Integrasi | Komponen web yang dapat disematkan pada alur eKYC bank, e-wallet, atau layanan publik |

## Demo

| Tautan | Keterangan |
|---|---|
| https://sonarid.my.id | Produk live (Chrome Android, kamera belakang untuk KTP) |
| https://sonarid.my.id/kartu-uji.html | Kartu uji fiktif pengganti KTP |
| https://sonarid.my.id/?debug=1 | Mode diagnosis: kotak deteksi dan angka analisis di bawah kamera |
| Video demo cadangan (maksimal 3 menit) | Tautan tercantum di formulir finalis dan halaman Devpost tim |

## Penggunaan

| No | Langkah | Yang terjadi |
|---|---|---|
| 1 | Buka https://sonarid.my.id di Chrome Android | Tidak perlu instal atau login. Suara pemandu SonarID dimuat otomatis; tidak perlu mengatur suara atau bahasa ponsel |
| 2 | (Opsional) Ketuk **Uji suara dan getar** | Memastikan suara terdengar dan ponsel bergetar |
| 3 | Pilih tingkat detail suara: Lengkap, Ringkas, atau Nada saja | Tersimpan di perangkat untuk kunjungan berikutnya |
| 4 | (Opsional) Aktifkan **Mode Uji Non-Visual** | Layar menjadi gelap; seluruh proses diselesaikan hanya dengan suara, nada, dan getar |
| 5 | Ketuk **Mulai Verifikasi**, letakkan KTP (atau kartu uji) di atas meja | Ikuti suara; foto KTP diambil otomatis sekitar 0,3 detik setelah KTP utuh dan cukup besar |
| 6 | Balik ponsel untuk swafoto | Ikuti suara; foto wajah diambil otomatis saat posisi tepat |
| 7 | Dengarkan ringkasan hasil, lalu kirim ke penyedia (simulasi) | Pada Mode Non-Visual: ketuk bagian atas layar dua kali untuk mengirim |

Kartu uji pengganti KTP ada di `/kartu-uji.html` (tampilkan di layar lain atau cetak seukuran KTP). Jangan memakai KTP asli untuk demo atau video.

## Alur

| No | Layar | Fungsi |
|---|---|---|
| 1 | Beranda | Status suara pemandu, uji suara dan getar, tingkat detail suara, Mode Uji Non-Visual |
| 2 | Foto KTP | Kamera belakang. Foto otomatis sekitar 0,3 detik setelah KTP terlihat utuh dan cukup besar untuk dibaca. Panduan arah, jarak, dan kemiringan hanya muncul bila KTP belum layak |
| 3 | Pemeriksaan KTP | Keterbacaan 16 digit NIK (OCR; kartu miring diluruskan dulu), ketajaman, cahaya, pantulan, dan deteksi KTP terbalik. Isi NIK tidak pernah dibacakan |
| 4 | Swafoto | Kamera depan. Panduan posisi, jarak, kemiringan, dan arah wajah dengan MediaPipe Face Landmarker |
| 5 | Hasil pemeriksaan | Ringkasan dibacakan. Pengguna menyetujui sebelum foto dikirim |
| 6 | Penyedia (simulasi) | Bank fiktif menerima foto, laporan kualitas, dan sidik SHA-256 foto. Keputusan akhir tetap milik penyedia |
| — | Bantuan petugas | Ditawarkan otomatis setelah 3 kali gagal |
| — | Kinerja | Jeda analisis, jumlah percobaan, dan waktu penyelesaian, dicatat di perangkat |

## Umpan balik non-visual

| Informasi | Suara (utama) | Nada, getar, dan layar (pendukung) |
|---|---|---|
| Kiri-kanan | "Geser ponsel ke kiri/kanan", atau "Sedikit ke kiri" bila tinggal sedikit | Bunyi bergeser ke telinga kiri atau kanan; panah di layar |
| Depan-belakang (KTP di meja) | "Geser ponsel ke depan/belakang" | Tinggi nada naik atau turun; panah di layar |
| Jarak | "Dekatkan/Jauhkan ponsel" | Laju ketukan melambat saat mendekati jarak ideal |
| Kemiringan KTP | "Putar ponsel searah/berlawanan jarum jam" | Panah putar di layar |
| Kemajuan | "Bagus, terus" saat bergerak ke arah yang benar, "Kelewatan" saat gerakan melewati posisi tepat | Catatan yang sama tampil di layar |
| Posisi tepat | Foto langsung diambil | Nada jernih dan stabil, getar ganda, tulisan "Posisi tepat" |
| Foto diambil | "Foto KTP diambil. Sedang diperiksa." | Bunyi rana dan getar singkat |
| Ruangan gelap | "Terlalu gelap…", lalu "Senter dinyalakan" bila ponsel mendukung | — |
| Gagal | Alasan singkat dan arah perbaikan | Nada turun dan pola getar |

Hanya satu instruksi disampaikan pada satu waktu. **Tulisan di layar selalu sama dengan kalimat yang sedang diucapkan**: layar diperbarui pada saat kalimat baru mulai diucapkan, bukan mengikuti hitungan per frame.

### Suara pemandu (suara AI)

| Aspek | Penjelasan |
|---|---|
| Sumber suara | 158 kalimat pemandu dibuat sekali dengan TTS neural bahasa Indonesia (bawaan: Microsoft `id-ID-GadisNeural`), disimpan sebagai MP3 kecil di `public/voice` |
| Mengapa | Suara sama jelasnya di semua ponsel, tanpa logat Inggris dan tanpa perlu memasang atau mengatur suara bahasa Indonesia di ponsel |
| Cara kerja | Setiap kalimat diberi kunci hash dari teksnya. Aplikasi memutar potongan kalimat dengan Web Audio, memotong hening di awal dan akhir agar terasa seketika, dan melirihkan nada saat suara berbicara |
| Cadangan | Bila rekaman belum termuat, dipakai suara bahasa Indonesia milik ponsel. Suara berbahasa lain tidak pernah dipakai |
| Luring | Setelah kunjungan pertama, rekaman tersimpan oleh service worker sehingga tetap berfungsi tanpa sinyal |

### Ketepatan deteksi KTP

| Mekanisme | Fungsi |
|---|---|
| Dua jalur deteksi | Jalur kecerahan untuk meja gelap; jalur warna biru KTP untuk meja putih, abu-abu, dan kayu yang kecerahannya mirip kartu |
| Analisis area yang tampil di layar | Penilaian posisi sesuai bingkai di layar, juga pada webcam laptop berasio lebar |
| Median beberapa frame dan pemungutan suara instruksi | Satu frame keliru tidak mengubah instruksi |
| Ambang ganda dan histeresis | Kartu tetap terdeteksi walau sebagian tertutup bayangan ponsel, pita kedip layar, atau fokus kamera sedang menyesuaikan |
| Toleransi perspektif dan kemiringan | Ponsel tidak harus sejajar meja; kemiringan sampai 30 derajat diluruskan otomatis sebelum NIK dibaca |
| Kartu terpotong tepi layar tetap dikenali | Pengguna mendapat arah geser yang benar, bukan "KTP belum terlihat" |
| Kalimat menyesuaikan kamera | Kamera belakang: "geser ponsel". Webcam laptop untuk uji coba: "geser KTP", dengan pratinjau dicerminkan |
| Foto otomatis saat KTP cukup terbaca | Kartu cukup selebar sepertiga layar (asal digit NIK cukup besar); tiga frame diambil dan yang paling tajam dipakai |
| Penerimaan berdasarkan NIK | Pantulan ringan, cahaya agak kurang, atau sedikit buram tidak menggagalkan foto selama NIK terbaca |

## Teknologi

| Bagian | Teknologi |
|---|---|
| Aplikasi | React 19 + Vite, Progressive Web App (service worker, dapat dipasang) |
| Pengenalan wajah | MediaPipe Face Landmarker (478 titik wajah), berjalan di perangkat |
| Deteksi KTP | Analisis citra buatan tim: ambang Otsu ganda pada kecerahan dan warna, komponen terhubung, momen citra, acuan rasio kartu ID-1 ISO/IEC 7810 |
| Kualitas foto | Variansi Laplacian (ketajaman), kecerahan, rasio piksel silau |
| OCR NIK | Tesseract.js (angka saja), hanya pada area NIK, dengan pelurusan dan koreksi cahaya |
| Suara pemandu | Rekaman TTS neural bahasa Indonesia (MP3) diputar dengan Web Audio API; cadangan Web Speech API (hanya suara id-ID) |
| Nada dan getar | Web Audio API (StereoPanner, oscillator), Vibration API |
| Keamanan | Content-Security-Policy, HSTS, Permissions-Policy, sidik SHA-256 (Web Crypto), komponen AI disajikan dari situs sendiri |
| Pengujian | `node:test` (uji unit), GitHub Actions (CI), Playwright dengan video kamera buatan (uji ujung ke ujung) |
| Hosting | cPanel (Apache/LiteSpeed) dengan SSL, domain sonarid.my.id |

## Arsitektur

| Lapisan | Isi |
|---|---|
| Kamera | getUserMedia, kamera belakang 1080p untuk KTP, kamera depan untuk swafoto; yang dianalisis hanya area yang tampil di layar |
| Analisis per frame (±15–20 per detik) | Deteksi KTP (kecerahan dan warna), cahaya dan pantulan setempat, MediaPipe untuk wajah |
| Penyaring | Median beberapa frame, histeresis, pemungutan suara instruksi |
| Mesin keputusan | Satu instruksi per waktu; foto otomatis setelah KTP layak sekitar 0,3 detik |
| Umpan balik | Rekaman suara pemandu, nada stereo, getar, panah layar, senter otomatis |
| AI Quality Check | Frame tertajam, pelurusan kartu, koreksi cahaya, OCR NIK, deteksi KTP terbalik |
| Penyedia (simulasi) | Menerima foto, laporan kualitas, dan sidik SHA-256 setelah pengguna menyetujui |

## Instalasi

Prasyarat: Node.js 20 atau lebih baru, npm, dan Git.

| No | Perintah | Fungsi |
|---|---|---|
| 1 | `git clone https://github.com/Raffnth/Balap-Kuda-Bukan-Instrumen-Inception-2026.git && cd Balap-Kuda-Bukan-Instrumen-Inception-2026` | Ambil kode |
| 2 | `npm install` | Pasang pustaka |
| 3 | `npm run dev` | Jalankan di `http://localhost:5173` (kamera hanya bisa dibuka di `localhost` atau HTTPS) |
| 4 | `npm test` | Uji unit (deteksi KTP, katalog suara, keputusan, keamanan) |
| 5 | `npm run build` | Build produksi ke folder `dist`; otomatis menjalankan `npm run assets` lebih dulu |

### Suara pemandu

Rekaman suara sudah ada di `public/voice`. Buat ulang hanya bila kalimat di `src/lib/messages.js` diubah:

| Perintah | Keterangan |
|---|---|
| `npm i -D -E msedge-tts` lalu `npm run voice` | Mesin bawaan (tanpa kunci API) |
| `pip install edge-tts` lalu `npm run voice -- --engine edge-py` | Alternatif dengan Python |
| `AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=southeastasia npm run voice -- --engine azure` | Layanan resmi berlisensi (disarankan untuk produksi) |
| `GOOGLE_TTS_API_KEY=... npm run voice -- --engine google` | Google Cloud Text-to-Speech |
| `npm run voice -- --voice id-ID-ArdiNeural` | Suara pria |
| `npm run voice -- --check` | Periksa kelengkapan rekaman (dipakai CI) |

### Komponen AI disajikan dari situs sendiri

`npm run assets` (otomatis sebelum build) menyalin berkas WASM MediaPipe dan Tesseract dari `node_modules`, mengunduh model wajah dan data bahasa OCR sekali, lalu menulis `public/vendor/vendor.json` berisi sidik SHA-256 setiap berkas. Folder ini tidak masuk git. Bila langkah ini dilewati, aplikasi otomatis memakai CDN resmi.

### Publikasi ke hosting

| No | Langkah |
|---|---|
| 1 | `npm run build` |
| 2 | Kompres seluruh isi folder `dist` (termasuk `.htaccess`, `voice`, dan `vendor`) menjadi zip |
| 3 | Di cPanel, buka File Manager, unggah zip ke `public_html`, lalu Extract (timpa berkas lama) |
| 4 | Pastikan SSL aktif (SSL/TLS Status, lalu Run AutoSSL) dan buka https://sonarid.my.id |
| 5 | Di ponsel uji: Setelan situs, lalu Hapus data situs, agar service worker lama diganti |

## Privasi dan keamanan

Ringkasan di bawah; rincian dan model ancaman di [SECURITY.md](SECURITY.md).

| Perlindungan | Penjelasan |
|---|---|
| Analisis di perangkat | Frame kamera dianalisis di ponsel dan tidak dikirim ke server |
| Data tidak menetap | Foto hanya ada di memori halaman, dihapus saat kembali ke beranda, dan seluruh sesi dihapus bila aplikasi ditinggalkan lebih dari 5 menit |
| Isi KTP tidak dibacakan | SonarID hanya menyampaikan status, misalnya "NIK terbaca"; angka NIK tidak disimpan |
| Sidik integritas | SHA-256 setiap foto dihitung saat lulus pemeriksaan dan ikut dalam laporan, sehingga penyedia dapat menolak foto yang diubah |
| Header keamanan | CSP ketat, HSTS, Permissions-Policy (kamera hanya untuk situs ini), anti-iframe, nosniff, berkas sensitif diblokir |
| Rantai pasok | Komponen AI disajikan dari situs sendiri dengan daftar sidik SHA-256; versi pustaka dikunci |
| Batas peran | SonarID tidak memberi sinyal apa pun terkait pemeriksaan keaslian wajah. Keputusan verifikasi tetap milik penyedia |

## AI Use Declaration

| Alat/model AI | Peran |
|---|---|
| MediaPipe Face Landmarker (Google) | Komponen AI di dalam produk untuk membaca posisi dan arah wajah di perangkat |
| Tesseract.js (model LSTM, angka saja) | Komponen AI di dalam produk untuk memastikan 16 digit NIK terbaca |
| TTS neural bahasa Indonesia (Microsoft `id-ID-GadisNeural`) | Menghasilkan rekaman suara pemandu (`public/voice`) sekali saat pengembangan. Suara ini adalah suara buatan AI, bukan rekaman manusia. Tidak ada TTS yang dipanggil saat aplikasi dipakai |
| Claude (Anthropic) | Alat bantu pengembangan: membantu menulis kode, merancang dan menjalankan pengujian otomatis, serta menyusun draf README, pitch deck, dan naskah video. Seluruh kode dan materi ditinjau, dijalankan, diuji, dan disetujui oleh tim |

Tidak ada model bahasa besar yang dipakai di dalam produk. Panduan harus merespons hampir seketika, tetap berjalan di perangkat, dan tidak mengirim foto wajah ke luar perangkat.

## Third-Party Declaration

| Pustaka/aset | Lisensi | Penggunaan |
|---|---|---|
| React, React DOM | MIT | Antarmuka |
| Vite, @vitejs/plugin-react | MIT | Build dan server pengembangan |
| Oxlint | MIT | Pemeriksa kode |
| @mediapipe/tasks-vision 0.10.3 (berkas WASM disalin ke `/vendor`, cadangan jsDelivr) | Apache-2.0 | Pengenalan wajah |
| Model `face_landmarker.task` (Google) | Apache-2.0 | Pengenalan wajah |
| Tesseract.js 5.1.1, tesseract.js-core, data bahasa `eng` (@tesseract.js-data) | Apache-2.0 | OCR NIK |
| msedge-tts (alat pengembangan, tidak ikut ke aplikasi) | MIT | Membuat rekaman suara pemandu |
| Suara neural Microsoft `id-ID-GadisNeural` (melalui layanan Read Aloud Microsoft Edge) | Ketentuan layanan Microsoft | Rekaman suara pemandu. Untuk pemakaian produksi, rekaman dibuat ulang dengan Azure AI Speech berlisensi (`--engine azure`) |

Ikon, logo, kartu uji, seluruh kalimat panduan, dan teks dibuat oleh tim. Merek "Bank Contoh Nusantara" adalah fiktif. Tidak ada OpenCV atau model deteksi dokumen pihak ketiga; detektor KTP ditulis tim.

## Hasil pengujian tim

Rincian metode dan angka: [docs/EVALUASI.md](docs/EVALUASI.md). Pengujian dilakukan oleh anggota tim dengan kartu uji fiktif, gambar sintetis, dan video kamera buatan; belum melibatkan pengguna tunanetra.

## Keterbatasan yang diketahui

| Keterbatasan | Dampak | Rencana |
|---|---|---|
| Belum diuji langsung oleh penyandang tunanetra | Kenyamanan kalimat dan tempo belum divalidasi pengguna sasaran | Uji kegunaan bersama komunitas tunanetra |
| Jalur warna mengandalkan latar biru KTP | Kartu lain yang tidak biru di atas meja terang tetap perlu meja gelap | Model deteksi tepi kartu sebagai jalur ketiga |
| Getar tidak tersedia di iPhone (batasan browser) | Panduan di iPhone hanya suara dan nada | — |
| Rekaman suara hanya untuk kalimat di katalog | Kalimat baru perlu `npm run voice` sebelum build | Diperiksa otomatis oleh uji unit dan CI |
| CSP masih mengizinkan `unsafe-eval` | Dibutuhkan WebAssembly MediaPipe/Tesseract | Dicabut bila pustaka sudah mendukung |
| Halaman penyedia masih simulasi | Belum ada pengiriman nyata | Integrasi API dengan penyedia eKYC |
| OCR hanya memeriksa keterbacaan NIK, bukan keaslian dokumen | — | Keputusan verifikasi tetap milik penyedia |

## Lisensi

MIT. Lihat berkas `LICENSE`.
