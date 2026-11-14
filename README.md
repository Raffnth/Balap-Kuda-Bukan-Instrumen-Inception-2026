# SonarID — eKYC Inklusif bagi Penyandang Tunanetra

SonarID memandu penyandang tunanetra memotret **KTP** dan **swafoto** untuk eKYC secara mandiri melalui **suara, nada, dan getar**. Foto diambil otomatis saat posisi tepat, diperiksa dengan **AI Quality Check**, lalu diserahkan ke penyedia layanan setelah pengguna menyetujui. Seluruh analisis berjalan di perangkat pengguna.

**INCEPTION 2026** · Health, Well-being & Accessibility · Tim **Balap Kuda Bukan Instrumen**, Politeknik Siber dan Sandi Negara

| Tautan | |
|---|---|
| Produk | https://sonarid.my.id |
| Kartu uji fiktif | https://sonarid.my.id/kartu-uji.html |
| Perubahan sejak `submission-24h` | [CHANGELOG.md](CHANGELOG.md) |

## Masalah dan solusi

| | |
|---|---|
| Masalah | Panduan foto eKYC sepenuhnya visual. Penyandang tunanetra sering gagal verifikasi atau harus menyerahkan KTP dan wajahnya kepada orang lain |
| Solusi | Bingkai kamera diubah menjadi suara, nada stereo, dan getar; foto diambil otomatis dan diperiksa sebelum dikirim |
| Integrasi | Komponen web yang dapat disematkan pada alur eKYC bank, e-wallet, dan layanan publik |

## Fitur utama

| Fitur | Keterangan |
|---|---|
| Suara pemandu AI | 158 kalimat bahasa Indonesia, sama di semua ponsel tanpa pengaturan suara |
| Panduan multisensori | Suara, nada stereo, dan getar; tulisan dan panah di layar selalu sama dengan kalimat yang diucapkan |
| Foto otomatis | KTP difoto sekitar 0,3 detik setelah terlihat utuh; swafoto saat wajah tepat di tengah |
| Deteksi KTP | Bekerja di meja gelap maupun terang (putih, abu-abu, kayu) |
| AI Quality Check | Keterbacaan NIK, ketajaman, cahaya, pantulan, posisi dan arah wajah |
| Mode Uji Non-Visual | Layar gelap; proses diselesaikan hanya dengan suara, nada, dan getar |
| Laporan ke penyedia | Hasil pemeriksaan dan sidik SHA-256 setiap foto |

## Penggunaan

| No | Langkah |
|---|---|
| 1 | Buka https://sonarid.my.id di Chrome Android |
| 2 | (Opsional) Ketuk **Uji suara dan getar** atau aktifkan **Mode Uji Non-Visual** |
| 3 | Ketuk **Mulai Verifikasi**, letakkan KTP atau kartu uji di meja, ikuti suara |
| 4 | Balik ponsel untuk swafoto, ikuti suara |
| 5 | Dengarkan ringkasan hasil, lalu kirim ke penyedia |

## Teknologi

| Bagian | Teknologi |
|---|---|
| Aplikasi | React 19, Vite, Progressive Web App |
| Wajah | MediaPipe Face Landmarker |
| KTP | Detektor buatan tim (ambang Otsu pada kecerahan dan warna, momen citra, rasio kartu ISO/IEC 7810) |
| NIK | Tesseract.js |
| Umpan balik | Web Audio API, Vibration API, rekaman TTS neural |
| Keamanan | CSP, HSTS, Permissions-Policy, Web Crypto (SHA-256) |
| Pengujian | `node:test`, GitHub Actions, Playwright |

## Instalasi

Prasyarat: Node.js 20+, npm, Git.

```bash
git clone https://github.com/Raffnth/Balap-Kuda-Bukan-Instrumen-Inception-2026.git
cd Balap-Kuda-Bukan-Instrumen-Inception-2026
npm install
npm run dev      # http://localhost:5173
npm test         # uji unit
npm run build    # hasil di folder dist
```

Publikasi: unggah seluruh isi folder `dist` (termasuk `.htaccess`) ke hosting dengan SSL aktif. Rekaman suara dibuat ulang dengan `npm run voice` bila kalimat di `src/lib/messages.js` diubah.

## Privasi dan keamanan

| Perlindungan | Penjelasan |
|---|---|
| Di perangkat | Frame kamera tidak dikirim ke server |
| Tidak menetap | Foto dihapus saat sesi selesai atau setelah 5 menit ditinggalkan |
| Isi KTP dirahasiakan | Yang diucapkan hanya status, misalnya "NIK terbaca" |
| Integritas | Sidik SHA-256 foto ikut dalam laporan ke penyedia |
| Situs | CSP, HSTS, anti-iframe, berkas sensitif diblokir, komponen AI disajikan dari situs sendiri |

Rincian di [SECURITY.md](SECURITY.md); hasil pengujian di [docs/EVALUASI.md](docs/EVALUASI.md).

## Kontribusi tim

| Anggota | Peran | Kontribusi |
|---|---|---|
| Raffi Anantha Setiawan | Ketua Tim | Memimpin tim dan menjalankan aspek teknis perlombaan |
| Rizky Zakariya | Anggota 1 | Riset dan pengembangan aplikasi |
| Ni Made Dwi Armalayanti | Anggota 2 | Pitch deck dan video demo |

## AI Use Declaration

| Alat/model AI | Penggunaan |
|---|---|
| MediaPipe Face Landmarker | Komponen produk: posisi dan arah wajah |
| Tesseract.js | Komponen produk: keterbacaan NIK |
| TTS neural Microsoft `id-ID-GadisNeural` | Membuat rekaman suara pemandu saat pengembangan (suara buatan AI) |
| Claude (Anthropic) | Alat bantu pengembangan: kode, pengujian, dan draf dokumentasi; seluruh hasil ditinjau dan diuji tim |

## Third-Party Declaration

| Pustaka/aset | Lisensi |
|---|---|
| React, Vite, Oxlint | MIT |
| @mediapipe/tasks-vision 0.10.3 dan model `face_landmarker.task` | Apache-2.0 |
| Tesseract.js 5.1.1 dan data bahasa `eng` | Apache-2.0 |
| msedge-tts (alat pengembangan) | MIT |
| Suara neural Microsoft `id-ID-GadisNeural` | Ketentuan layanan Microsoft |

Kartu uji, ikon, kalimat panduan, dan detektor KTP dibuat tim. "Bank Contoh Nusantara" adalah merek fiktif.

## Ruang lingkup

| Batasan | Keterangan |
|---|---|
| Pengujian | Dilakukan internal oleh tim dengan kartu uji fiktif; uji kegunaan bersama komunitas tunanetra adalah tahap berikutnya |
| Dokumen | Dirancang untuk KTP elektronik Indonesia |
| Platform | Dirancang untuk Chrome Android; di iPhone panduan menggunakan suara dan nada |
| Peran | SonarID memastikan foto layak; keputusan verifikasi identitas tetap milik penyedia |
| Integrasi | Halaman penyedia merupakan simulasi |

## Lisensi

MIT — lihat [LICENSE](LICENSE).
