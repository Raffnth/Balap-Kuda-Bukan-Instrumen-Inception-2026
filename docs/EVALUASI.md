# Evaluasi SonarID `finalist-release`

Pengujian internal oleh anggota tim memakai **kartu uji fiktif** (bukan KTP asli), gambar sintetis, dan video kamera buatan. Uji kegunaan bersama komunitas tunanetra adalah tahap berikutnya.

## Ringkasan

| Pengujian | Hasil |
|---|---|
| Deteksi KTP pada gambar uji (5 jenis permukaan meja) | 40/40 terdeteksi, 0/10 deteksi palsu |
| Uji ujung ke ujung dengan video kamera buatan | 29/29 video berisi kartu terfoto otomatis; 0/3 foto palsu pada kontrol negatif |
| Waktu foto saat kartu langsung terlihat | Median 0,56 detik |
| Keterbacaan NIK (OCR) | 3/3 video terbaca benar |
| Kesesuaian tulisan dan suara | Selisih 0,04 detik dari 88,5 detik panduan |
| Uji otomatis (`npm test`) | 30/30 lulus |

## 1. Deteksi KTP pada berbagai permukaan meja (gambar sintetis)

Metode: 50 gambar dibuat program (`tests/helpers/scene.mjs`): kartu biru muda berisi teks dan foto di atas 5 jenis permukaan, 4 ukuran/kemiringan (lebar 35–70%, miring 0–25°), dengan dan tanpa lampu kuning; ditambah meja kosong dan kertas biru polos tanpa teks sebagai kontrol negatif. Resolusi analisis sama dengan aplikasi (192 × 256 piksel).

| Permukaan | Kartu terdeteksi | Deteksi palsu |
|---|---|---|
| Meja gelap | 8/8 | 0/2 |
| Meja kayu tua | 8/8 | 0/2 |
| Meja putih | 8/8 | 0/2 |
| Meja abu-abu | 8/8 | 0/2 |
| Meja kayu terang | 8/8 | 0/2 |
| **Total** | **40/40 (100%)** | **0/10** |

Waktu analisis per frame (Node.js, laptop pengembang): 1,1 ms di meja gelap dan 5,1 ms di meja putih (jalur warna hanya berjalan bila jalur kecerahan belum menemukan kartu), jauh di bawah anggaran 50 ms per frame.

## 2. Keterbacaan NIK dari potongan hasil deteksi (OCR nyata)

Metode: frame ke-100 dari video kamera buatan 540 × 960, kartu uji di tengah. Kotak kartu dari detektor dipakai untuk memotong area NIK seperti di aplikasi, lalu dibaca dengan Tesseract (angka saja).

| Video | Jalur deteksi | NIK terbaca |
|---|---|---|
| Meja putih | Warna | 3578012345670001 (16 digit, benar) |
| Meja kayu terang, lampu kuning | Warna | 3578012345670001 (benar) |
| Meja kayu tua, kartu masuk dari kiri | Kecerahan | 3578012345670001 (benar) |

## 3. Uji ujung ke ujung (Playwright + video kamera buatan)

Metode: aplikasi dijalankan di Chromium (Playwright) dengan kamera palsu yang memutar video uji 540 × 960 (kartu uji fiktif), layar ponsel 412 × 860. OCR dan MediaPipe diganti tiruan agar yang diukur hanya deteksi dan panduan. Waktu foto = dari ketukan "Mulai Verifikasi" sampai layar "Memeriksa kualitas foto".

| Kelompok video | Hasil |
|---|---|
| Kartu langsung terlihat (15 video: tengah, pinggir, miring, perspektif, bayangan, pantulan, pita kedip layar, dijepit jari, latar gelap, terang, kartu di layar laptop) | 15/15 terfoto, median 0,56 detik (0,52–0,59) |
| Meja putih, meja kayu terang (lampu kuning), kartu mendekat di meja putih | 3/3 terfoto (0,6 detik; mendekat 4,9 detik) |
| Kartu masuk dari luar layar, bergerak pelan, kelewatan, bergerak kiri-kanan (5 video) | 5/5 terfoto |
| Webcam laptop (6 video, kalimat "geser KTP") | 6/6 terfoto |
| Kontrol negatif: terlalu dekat, ruangan redup, jendela terang tanpa kartu | 0/3 terfoto (benar) |
| **Total video berisi kartu** | **29/29** |

Catatan: kartu yang masuk perlahan difoto setelah 8–13 detik karena kartu baru masuk bingkai pada detik itu di videonya; kalimat pembuka sekitar 6 detik diputar bersamaan (foto otomatis tetap berjalan selama kalimat pembuka).

## 4. Kesesuaian tulisan dan suara

Metode: selama panduan KTP, teks instruksi di layar dicatat setiap 15 ms dan setiap kalimat yang diucapkan dicatat saat mulai diputar. Untuk setiap 20 ms dihitung apakah arah di layar (kiri, kanan, depan, belakang, dekat, jauh, putar) berbeda dengan arah pada kalimat terakhir yang diucapkan. Kalimat pembuka, "Posisi tepat", dan "Bagus, terus" tidak dihitung sebagai arah.

| Ukuran | Hasil |
|---|---|
| Waktu panduan yang diperiksa | 88,5 detik |
| Waktu tulisan berbeda arah dengan suara | 0,04 detik (satu sampel, setara 0%) |
| Ketidaksesuaian terpanjang | 0,02 detik |
| Video bergerak kiri-kanan (kamera belakang) | 0 detik |

Rekaman suara sudah berada di memori dan tulisan di layar diambil dari kalimat yang sedang diucapkan, sehingga keduanya berganti pada saat yang sama.

| Sumber suara | Hasil uji |
|---|---|
| Rekaman suara pemandu tersedia | Semua kalimat diputar dari rekaman (`via = clip`) |
| Rekaman tidak tersedia, ponsel punya suara id-ID | Otomatis memakai suara ponsel (`via = tts`), KTP tetap terfoto 0,53 detik |
| Header keamanan produksi (CSP) diterapkan | Alur KTP berjalan, tidak ada pelanggaran CSP di konsol |

## 5. Uji otomatis

`npm test` menjalankan 30 uji: deteksi KTP di 5 permukaan, kelengkapan katalog 158 kalimat suara pada semua level dan jenis kamera, kelengkapan berkas rekaman suara, keputusan jarak/arah, panah layar, header keamanan, ketiadaan skrip sebaris, dan SHA-256. Semua lulus dan dijalankan otomatis oleh GitHub Actions pada setiap push.

## Cara mengulang

| Pengujian | Perintah/berkas |
|---|---|
| Uji otomatis | `npm test` |
| Deteksi KTP pada gambar uji | `node --test tests/card.test.mjs` |
| Uji ujung ke ujung | Chrome/Playwright dengan `--use-file-for-fake-video-capture=<video.y4m>`; teks layar dicatat tiap 15 ms dan ucapan dari peristiwa `sonarid:say` |
