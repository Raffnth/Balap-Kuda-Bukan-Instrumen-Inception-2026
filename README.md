# SonarID — eKYC Inklusif bagi Penyandang Tunanetra

SonarID adalah komponen web yang memandu penyandang tunanetra memotret **KTP** dan **swafoto** untuk proses eKYC secara mandiri melalui **suara, nada, dan getar**. Foto diambil otomatis saat posisi sudah tepat, lalu diperiksa kualitasnya (**AI Quality Check**) sebelum diserahkan ke penyedia layanan. Seluruh analisis berlangsung di perangkat pengguna.

Dibuat oleh tim **Balap Kuda Bukan Instrumen** untuk Hacking Day **INCEPTION 2026** (Subtema: Health, Well-being & Accessibility).

## Coba sekarang

- Aplikasi: buka tautan Cloudflare Pages tim di Chrome Android (tidak perlu instal atau login).
- Kartu uji pengganti KTP: buka `/kartu-uji.html` di layar lain, atau cetak seukuran KTP. Semua data pada kartu uji fiktif.
- Untuk membuktikan proses tanpa melihat layar, aktifkan **Mode Uji Non-Visual** di beranda.

## Alur

| No | Layar | Fungsi |
|---|---|---|
| 1 | Beranda | Pilih tingkat detail suara (Lengkap, Ringkas, Nada saja) dan Mode Uji Non-Visual |
| 2 | Foto KTP | Kamera belakang. Cek cahaya, lalu panduan arah, jarak, dan kemiringan. Foto diambil otomatis saat stabil |
| 3 | Pemeriksaan KTP | Ketajaman, cahaya, silau, keterbacaan 16 digit NIK (OCR), dan deteksi KTP terbalik. Isi NIK tidak pernah dibacakan |
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
| Posisi tepat | "Posisi tepat. Tahan sebentar." | Nada jernih dan stabil |
| Foto diambil | "Foto diambil" | Bunyi rana dan getar singkat |
| Gagal | Alasan singkat dan arah perbaikan | Nada turun dan pola getar |

Hanya satu instruksi disampaikan pada satu waktu, dengan urutan prioritas: keberadaan objek, cahaya, jarak, posisi, kemiringan, lalu kestabilan.

Agar instruksi KTP tidak keliru atau berganti-ganti:

| Mekanisme | Fungsi |
|---|---|
| Analisis area yang tampil di layar | Penilaian posisi sesuai dengan bingkai di layar, juga pada webcam laptop yang berasio lebar |
| Median beberapa frame dan pemungutan suara instruksi | Satu frame yang keliru tidak mengubah instruksi. Instruksi baru diucapkan setelah konsisten sekitar setengah detik |
| Cahaya dinilai pada kartu | Latar gelap yang dianjurkan tidak dianggap "terlalu gelap"; silau dihitung dari pantulan setempat |
| Kartu terpotong tepi layar tetap dikenali | Pengguna mendapat arah geser yang benar, bukan "KTP belum terlihat" |
| Kalimat menyesuaikan kamera | Kamera belakang ponsel: "geser ponsel". Webcam laptop untuk uji coba: "geser KTP", dengan pratinjau dicerminkan |
| Foto otomatis saat KTP cukup terbaca | Tidak harus pas di tengah; bila kartu utuh dan cukup besar selama sekitar 2,5 detik, foto tetap diambil |

## Teknologi

| Bagian | Teknologi |
|---|---|
| Aplikasi | React + Vite, Progressive Web App |
| Pengenalan wajah | MediaPipe Face Landmarker (478 titik wajah), berjalan di perangkat |
| Deteksi KTP | Analisis citra ringan buatan tim (ambang Otsu, komponen terhubung, momen citra) dengan acuan rasio kartu ID-1 ISO/IEC 7810 |
| Kualitas foto | Variansi Laplacian (ketajaman), kecerahan, rasio piksel silau |
| OCR NIK | Tesseract.js (angka saja), hanya pada area NIK |
| Suara, nada, getar | Web Speech API (id-ID), Web Audio API (StereoPanner), Vibration API |
| Hosting | Cloudflare Pages (HTTPS) |

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

Buka `http://localhost:5173`. Kamera hanya bisa diakses melalui `localhost` atau HTTPS, jadi uji di ponsel memakai tautan Cloudflare Pages.

Build produksi:

```bash
npm run build
```

Hasil build ada di folder `dist`.

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
