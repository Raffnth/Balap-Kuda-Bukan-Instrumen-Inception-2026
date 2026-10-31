# SonarID — eKYC Inklusif bagi Penyandang Tunanetra

SonarID adalah komponen web yang memandu penyandang tunanetra memotret **KTP** dan **swafoto** untuk proses eKYC secara mandiri melalui **suara, nada, dan getar**. Foto diambil otomatis saat posisi sudah tepat, lalu diperiksa kualitasnya (**AI Quality Check**) sebelum diserahkan ke penyedia layanan. Seluruh analisis berlangsung di perangkat pengguna.

Dibuat oleh tim **Balap Kuda Bukan Instrumen** untuk Hacking Day **INCEPTION 2026** (Subtema: Health, Well-being & Accessibility).

## Coba sekarang

- Aplikasi: buka **https://sonarid.my.id** di Chrome Android (tidak perlu instal atau login).
- Kartu uji pengganti KTP: buka `/kartu-uji.html` di layar lain, atau cetak seukuran KTP. Semua data pada kartu uji fiktif.
- Untuk membuktikan proses tanpa melihat layar, aktifkan **Mode Uji Non-Visual** di beranda.
- Tombol **Uji suara dan getar** di beranda memastikan suara bahasa Indonesia dan getar berfungsi sebelum mulai.
- Mode diagnosis: buka `https://sonarid.my.id/?debug=1` untuk melihat kotak deteksi dan angka analisis di bawah kamera.

## Alur

| No | Layar | Fungsi |
|---|---|---|
| 1 | Beranda | Pilih tingkat detail suara (Lengkap, Ringkas, Nada saja) dan Mode Uji Non-Visual |
| 2 | Foto KTP | Kamera belakang. Foto diambil otomatis sekitar 0,4 detik setelah KTP terlihat utuh dan cukup besar untuk dibaca, tanpa harus pas di tengah. Panduan arah, jarak, dan kemiringan hanya muncul bila KTP belum layak |
| 3 | Pemeriksaan KTP | Keterbacaan 16 digit NIK (OCR, kartu miring diluruskan dulu), ketajaman, cahaya, pantulan, dan deteksi KTP terbalik. Foto diterima bila NIK terbaca; masalah ringan dicatat sebagai peringatan. Isi NIK tidak pernah dibacakan |
| 4 | Swafoto | Kamera depan. Panduan posisi, jarak, kemiringan, dan arah wajah dengan MediaPipe Face Landmarker |
| 5 | Hasil pemeriksaan | Ringkasan dibacakan. Pengguna menyetujui sebelum foto dikirim |
| 6 | Penyedia (simulasi) | Bank fiktif menerima foto dan laporan kualitas. Keputusan akhir tetap milik penyedia |
| — | Bantuan petugas | Ditawarkan otomatis setelah 3 kali gagal |
| — | Kinerja | Jeda analisis, jumlah percobaan, dan waktu penyelesaian, dicatat di perangkat |

## Umpan balik non-visual

| Informasi | Suara (utama) | Nada dan getar (pendukung) |
|---|---|---|
| Kiri-kanan | "Geser ponsel ke kiri/kanan", atau "Sedikit ke kiri" bila tinggal sedikit | Bunyi bergeser ke telinga kiri atau kanan |
| Depan-belakang (KTP di meja) | "Geser ponsel ke depan/belakang" | Tinggi nada naik atau turun |
| Jarak | "Dekatkan/Jauhkan ponsel" | Laju ketukan melambat saat mendekati jarak ideal |
| Kemiringan KTP | "Putar ponsel sedikit searah/berlawanan arah jarum jam" | — |
| Kemajuan | "Bagus, terus" saat bergerak ke arah yang benar, "Kelewatan" saat gerakan melewati posisi tepat | — |
| Posisi tepat | Foto langsung diambil ("Tahan" hanya bila perlu menunggu) | Nada jernih dan stabil, getar ganda |
| Foto diambil | "Foto KTP diambil. Sedang diperiksa." | Bunyi rana dan getar singkat |
| Ruangan gelap | "Terlalu gelap…", lalu "Senter dinyalakan" bila ponsel mendukung | — |
| Gagal | Alasan singkat dan arah perbaikan | Nada turun dan pola getar |

Hanya satu instruksi disampaikan pada satu waktu, dengan urutan prioritas: keberadaan objek, cahaya, jarak, posisi, kemiringan, lalu kestabilan.

Agar instruksi KTP tidak keliru atau berganti-ganti:

| Mekanisme | Fungsi |
|---|---|
| Analisis area yang tampil di layar | Penilaian posisi sesuai dengan bingkai di layar, juga pada webcam laptop yang berasio lebar |
| Median beberapa frame dan pemungutan suara instruksi | Satu frame yang keliru tidak mengubah instruksi. Instruksi baru diucapkan setelah konsisten sekitar 0,2 detik; nada dan getar berubah setiap frame |
| Ambang ganda dan histeresis | Kartu tetap terdeteksi walau sebagian tertutup bayangan ponsel, terkena pita kedip layar, atau fokus kamera sedang menyesuaikan |
| Toleransi perspektif dan kemiringan | Ponsel tidak harus sejajar meja; kemiringan sampai 30 derajat diluruskan otomatis sebelum NIK dibaca |
| Cahaya dinilai pada kartu | Latar gelap yang dianjurkan tidak dianggap "terlalu gelap"; silau dihitung dari pantulan setempat |
| Kartu terpotong tepi layar tetap dikenali | Pengguna mendapat arah geser yang benar, bukan "KTP belum terlihat" |
| Kalimat menyesuaikan kamera | Kamera belakang ponsel: "geser ponsel". Webcam laptop untuk uji coba: "geser KTP", dengan pratinjau dicerminkan |
| Foto otomatis saat KTP cukup terbaca | Tidak harus pas di tengah; begitu kartu utuh dan cukup besar selama sekitar 0,4 detik (dan tidak sedang digerakkan cepat), tiga frame diambil dan yang paling tajam dipakai |
| Penerimaan berdasarkan NIK | Pantulan ringan, cahaya agak kurang, atau sedikit buram tidak menggagalkan foto selama NIK terbaca. Bila gagal, saran perbaikan disesuaikan penyebabnya (pantulan, gelap, kurang fokus, atau terlalu jauh) |

## Teknologi

| Bagian | Teknologi |
|---|---|
| Aplikasi | React + Vite, Progressive Web App |
| Pengenalan wajah | MediaPipe Face Landmarker (478 titik wajah), berjalan di perangkat |
| Deteksi KTP | Analisis citra ringan buatan tim (ambang Otsu, komponen terhubung, momen citra) dengan acuan rasio kartu ID-1 ISO/IEC 7810 |
| Kualitas foto | Variansi Laplacian (ketajaman), kecerahan, rasio piksel silau |
| OCR NIK | Tesseract.js (angka saja), hanya pada area NIK |
| Suara, nada, getar | Web Speech API (id-ID), Web Audio API (StereoPanner), Vibration API |
| Hosting | Hosting cPanel (Apache/LiteSpeed) dengan SSL, domain sonarid.my.id. Konfigurasi server di `public/.htaccess` |

## Privasi dan keamanan

- Frame kamera dianalisis di perangkat dan tidak disimpan maupun dikirim ke server.
- Isi KTP tidak pernah dibacakan. SonarID hanya menyampaikan status, misalnya "NIK terbaca".
- SonarID hanya memberi petunjuk posisi dan tidak memberikan sinyal apa pun terkait pemeriksaan keaslian wajah. Keputusan verifikasi tetap milik penyedia.
- Halaman penyedia adalah simulasi dengan merek fiktif. Tidak ada data yang dikirim.

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

Buka `http://localhost:5173`. Kamera hanya bisa diakses melalui `localhost` atau HTTPS, jadi uji di ponsel memakai https://sonarid.my.id.

Build produksi:

```bash
npm run build
```

Hasil build ada di folder `dist`.

## Publikasi ke hosting

| No | Langkah |
|---|---|
| 1 | `npm run build` |
| 2 | Kompres seluruh isi folder `dist` (termasuk `.htaccess`) menjadi zip |
| 3 | Di cPanel, buka File Manager, unggah zip ke `public_html`, lalu Extract |
| 4 | Pastikan SSL aktif (SSL/TLS Status, lalu Run AutoSSL) dan buka https://sonarid.my.id |

`public/.htaccess` memaksa HTTPS, mengatur header keamanan (kamera hanya untuk situs ini), jenis berkas, cache, dan kompresi.

## AI Use Declaration

| Alat/model AI | Peran |
|---|---|
| MediaPipe Face Landmarker (Google) | Komponen AI di dalam produk untuk membaca posisi dan arah wajah di perangkat |
| Tesseract.js (model LSTM bahasa Inggris, angka saja) | Komponen AI di dalam produk untuk memastikan 16 digit NIK terbaca |
| Claude (Anthropic) | Alat bantu pengembangan selama Hacking Day: membantu menulis kode, menyusun README, dan merancang pengujian. Seluruh kode ditinjau, dijalankan, dan diuji oleh tim di laptop dan ponsel Android |

Tidak ada model bahasa besar yang dipakai di dalam produk. Panduan harus merespons hampir seketika, tetap berjalan di perangkat, dan tidak mengirim foto wajah ke luar perangkat.

## Third-Party Declaration

| Pustaka/aset | Lisensi | Penggunaan |
|---|---|---|
| React, React DOM | MIT | Antarmuka |
| Vite, @vitejs/plugin-react | MIT | Build dan server pengembangan |
| Oxlint | MIT | Pemeriksa kode |
| @mediapipe/tasks-vision 0.10.3 (beserta file WASM dari jsDelivr) | Apache-2.0 | Pengenalan wajah |
| Model `face_landmarker.task` (Google, dari storage.googleapis.com) | Apache-2.0 | Pengenalan wajah |
| Tesseract.js 5.1.1 beserta tesseract.js-core dan data bahasa `eng` | Apache-2.0 | OCR NIK |

Ikon, logo, kartu uji, dan seluruh teks dibuat oleh tim. Merek "Bank Contoh Nusantara" adalah fiktif.

## Lisensi

MIT
