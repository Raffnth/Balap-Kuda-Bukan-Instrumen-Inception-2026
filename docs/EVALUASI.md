# Evaluasi SonarID: versi `submission-24h` dibandingkan `finalist-release`

Semua pengujian dilakukan oleh anggota tim tanpa melibatkan orang luar, memakai **kartu uji fiktif** (bukan KTP asli), gambar sintetis, dan video kamera buatan. Belum ada pengujian dengan penyandang tunanetra.

## 1. Deteksi KTP pada berbagai permukaan meja (gambar sintetis)

Metode: 50 gambar per versi, dibuat program (`tests/helpers/scene.mjs`): kartu biru muda berisi teks dan foto di atas 5 jenis permukaan, 4 ukuran/kemiringan (lebar 35–70%, miring 0–25°), dengan dan tanpa lampu kuning; ditambah meja kosong dan kertas biru polos tanpa teks sebagai kontrol negatif. Resolusi analisis sama dengan aplikasi (192 × 256 piksel).

| Permukaan | Kartu terdeteksi, versi lama | Kartu terdeteksi, versi baru | Deteksi palsu (lama / baru) |
|---|---|---|---|
| Meja gelap | 8/8 | 8/8 | 0/2 / 0/2 |
| Meja kayu tua | 8/8 | 8/8 | 0/2 / 0/2 |
| Meja putih | 0/8 | 8/8 | 0/2 / 0/2 |
| Meja abu-abu | 0/8 | 8/8 | 0/2 / 0/2 |
| Meja kayu terang | 0/8 | 8/8 | 0/2 / 0/2 |
| **Total** | **16/40 (40%)** | **40/40 (100%)** | **0/10 / 0/10** |

Waktu analisis per frame (Node.js, laptop pengembang): meja gelap 1,0 → 1,1 ms; meja putih 2,8 → 5,1 ms (jalur warna hanya berjalan bila jalur kecerahan belum menemukan kartu). Masih jauh di bawah anggaran 50 ms per frame.

## 2. Keterbacaan NIK dari potongan hasil jalur warna (OCR nyata)

Metode: frame ke-100 dari video kamera buatan 540 × 960, kartu uji di tengah. Kotak kartu dari detektor dipakai untuk memotong area NIK seperti di aplikasi, lalu dibaca dengan Tesseract (angka saja).

| Video | Jalur deteksi | NIK terbaca |
|---|---|---|
| Meja putih | Warna | 3578012345670001 (16 digit, benar) |
| Meja kayu terang, lampu kuning | Warna | 3578012345670001 (benar) |
| Meja kayu tua, kartu masuk dari kiri | Kecerahan | 3578012345670001 (benar) |

## 3. Uji ujung ke ujung (Playwright + video kamera buatan)

Metode: aplikasi versi lama dan baru dijalankan di Chromium (Playwright) dengan kamera palsu yang memutar video uji 540 × 960 (kartu uji fiktif), layar ponsel 412 × 860. OCR dan MediaPipe diganti tiruan agar yang diukur hanya deteksi dan panduan. Waktu foto = dari ketukan "Mulai Verifikasi" sampai layar "Memeriksa kualitas foto".

| Kelompok video | Versi lama | Versi baru |
|---|---|---|
| Kartu langsung terlihat (15 video: tengah, pinggir, miring, perspektif, bayangan, pantulan, pita kedip layar, dijepit jari, latar gelap, terang, kartu di layar laptop) | 15/15 terfoto, median 0,62 detik (0,57–0,66) | 15/15 terfoto, median 0,56 detik (0,52–0,59) |
| Meja putih, meja kayu terang (lampu kuning), kartu mendekat di meja putih | 0/3 terfoto | 3/3 terfoto (0,6 detik; mendekat 4,9 detik) |
| Kartu masuk dari luar layar, bergerak pelan, kelewatan, bergerak kiri-kanan (5 video) | 5/5 terfoto | 5/5 terfoto |
| Kontrol negatif: terlalu dekat, ruangan redup, jendela terang tanpa kartu | 0/3 terfoto (benar) | 0/3 terfoto (benar) |
| Webcam laptop (6 video, kalimat "geser KTP") | 5/6 terfoto (meja putih gagal) | 6/6 terfoto |
| **Total video berisi kartu** | **25/29** | **29/29** |
| Foto palsu pada kontrol negatif | 0/3 | 0/3 |

Catatan: kartu yang masuk perlahan difoto setelah 8–13 detik karena kartu baru masuk bingkai pada detik itu di videonya; kalimat pembuka sekitar 6 detik diputar bersamaan (foto otomatis tetap berjalan selama kalimat pembuka).

## 4. Kesesuaian tulisan dan suara

Metode: selama panduan KTP, teks instruksi di layar dicatat setiap 15 ms dan setiap kalimat yang diucapkan dicatat saat mulai diputar. Untuk setiap 20 ms dihitung apakah arah di layar (kiri, kanan, depan, belakang, dekat, jauh, putar) berbeda dengan arah pada kalimat terakhir yang diucapkan. Kalimat pembuka, "Posisi tepat", dan "Bagus, terus" tidak dihitung sebagai arah.

| Ukuran | Versi lama | Versi baru |
|---|---|---|
| Waktu panduan yang diperiksa | 104,5 detik | 88,5 detik |
| Waktu tulisan berbeda arah dengan suara | 2,08 detik (2,0%) | 0,04 detik (satu sampel, setara 0%) |
| Ketidaksesuaian terpanjang | 0,56 detik | 0,02 detik |
| Video bergerak kiri-kanan (kamera belakang) | 1,08 detik berbeda dari 11,7 detik | 0 detik |

Angka versi lama di atas adalah batas bawah: di ponsel nyata, mesin TTS ponsel butuh sekitar 0,2–0,5 detik sebelum mulai bersuara, sehingga selisihnya lebih besar. Versi baru memutar rekaman yang sudah ada di memori, dan tulisan di layar diambil dari kalimat yang sedang diucapkan, sehingga keduanya berganti pada saat yang sama.

| Sumber suara | Hasil uji |
|---|---|
| Rekaman suara pemandu tersedia | Semua kalimat diputar dari rekaman (`via = clip`) |
| Rekaman tidak tersedia, ponsel punya suara id-ID | Otomatis memakai suara ponsel (`via = tts`), KTP tetap terfoto 0,53 detik |
| Header keamanan produksi (CSP) diterapkan | Alur KTP berjalan, tidak ada pelanggaran CSP di konsol |

## 5. Uji unit

`npm test` menjalankan 29 uji (deteksi KTP di 5 permukaan, kelengkapan katalog 158 kalimat suara pada semua level dan jenis kamera, keputusan jarak/arah, panah layar, header keamanan, ketiadaan skrip sebaris, SHA-256). Semua lulus; uji kelengkapan berkas suara dijalankan setelah `npm run voice`.

## Cara mengulang

| Pengujian | Perintah/berkas |
|---|---|
| Uji unit | `npm test` |
| Perbandingan detektor | Jalankan `tests/card.test.mjs` pada kode `submission-24h` dan `finalist-release` |
| Uji ujung ke ujung | Chrome/Playwright dengan `--use-file-for-fake-video-capture=<video.y4m>`; teks layar dicatat tiap 15 ms dan ucapan dari peristiwa `sonarid:say` |
