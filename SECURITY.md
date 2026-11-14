# Keamanan SonarID

SonarID menangani data paling sensitif dalam eKYC: foto KTP dan foto wajah. Prinsip kami: **data sesedikit mungkin, sesingkat mungkin, di tempat sesedikit mungkin**.

## Data yang ditangani

| Data | Di mana | Berapa lama | Dikirim ke luar? |
|---|---|---|---|
| Frame kamera | Memori halaman (kanvas analisis) | Beberapa milidetik per frame | Tidak |
| Foto KTP dan swafoto | Memori halaman (state aplikasi) | Sampai kembali ke beranda, atau 5 menit aplikasi ditinggalkan | Hanya ke penyedia setelah pengguna menyetujui (di prototipe: simulasi, tidak ada pengiriman) |
| Angka NIK hasil OCR | Tidak disimpan; hanya status "terbaca/tidak" | — | Tidak |
| Pengaturan (tingkat detail suara, mode non-visual) | localStorage | Sampai dihapus pengguna | Tidak |
| Statistik kinerja (jeda analisis, jumlah percobaan) | localStorage, tanpa gambar | Sampai dihapus di halaman Kinerja | Tidak |

## Model ancaman dan perlindungan

| Ancaman | Perlindungan |
|---|---|
| Penyadapan atau penggantian halaman di jaringan | HTTPS wajib (pengalihan 301) dan HSTS 1 tahun |
| Skrip jahat disisipkan (XSS) atau pustaka dari sumber tak dikenal | Content-Security-Policy: skrip hanya dari situs sendiri dan CDN cadangan komponen AI; tanpa skrip sebaris, tanpa plugin (`object-src 'none'`), `base-uri` dan `form-action` dibatasi |
| Halaman dibingkai situs lain (clickjacking) | `frame-ancestors 'none'` dan `X-Frame-Options: DENY` |
| Situs lain atau iframe memakai kamera | `Permissions-Policy: camera=(self)`; mikrofon, lokasi, pembayaran, USB, serial, dan bluetooth dimatikan |
| Penebakan jenis berkas oleh browser | `X-Content-Type-Options: nosniff` dan jenis MIME eksplisit |
| Kebocoran alamat halaman ke situs lain | `Referrer-Policy: no-referrer` |
| Akses lintas jendela | `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin` |
| Berkas sensitif terbuka (.git, .env, peta kode, cadangan, konfigurasi) | Diblokir `.htaccess` (403); daftar isi folder dimatikan |
| Metode HTTP yang tidak perlu | Hanya GET, HEAD, OPTIONS yang diterima (situs statis) |
| CDN pihak ketiga diretas atau tidak tersedia | Komponen AI disajikan dari situs sendiri (`/vendor`) dengan daftar sidik SHA-256 (`vendor.json`); versi pustaka dikunci; CDN hanya cadangan |
| Foto diubah setelah lulus pemeriksaan | Sidik SHA-256 setiap foto dihitung di ponsel saat lulus Quality Check (Web Crypto) dan ikut dalam laporan; penyedia membandingkan dengan foto yang diterima |
| Ponsel ditinggal atau dipinjam orang lain di tengah proses | Sesi dan foto dihapus otomatis bila aplikasi ditinggalkan lebih dari 5 menit; pengguna diberi tahu lewat suara |
| Isi KTP terdengar orang di sekitar | Isi KTP tidak pernah dibacakan; yang diucapkan hanya status |
| Penipuan wajah (foto/topeng) | Di luar peran SonarID. SonarID tidak memberi sinyal apa pun yang dapat dipakai untuk mengakali pemeriksaan keaslian; keputusan verifikasi tetap milik penyedia |

## Header yang dipasang

Semua di `public/.htaccess` (ikut tersalin ke `dist` saat build):

| Header | Nilai ringkas |
|---|---|
| Strict-Transport-Security | `max-age=31536000` |
| Content-Security-Policy | `default-src 'self'`; skrip `'self'` + jsDelivr; `object-src 'none'`; `frame-ancestors 'none'`; `upgrade-insecure-requests` |
| Permissions-Policy | `camera=(self)`, fitur lain dimatikan |
| X-Content-Type-Options | `nosniff` |
| Referrer-Policy | `no-referrer` |
| X-Frame-Options | `DENY` |
| Cross-Origin-Opener-Policy | `same-origin` |
| Cross-Origin-Resource-Policy | `same-origin` |

Catatan: CSP masih mengizinkan `'unsafe-eval'` dan `'wasm-unsafe-eval'` karena kode WebAssembly MediaPipe dan Tesseract (Emscripten) membutuhkannya. Skrip sebaris (`'unsafe-inline'`) tidak diizinkan.

## Cara memeriksa

| Pemeriksaan | Cara |
|---|---|
| Header keamanan | https://securityheaders.com/?q=sonarid.my.id atau `curl -sI https://sonarid.my.id` |
| Berkas sensitif diblokir | `curl -sI https://sonarid.my.id/.htaccess` harus 403 |
| Sidik komponen AI | Bandingkan `https://sonarid.my.id/vendor/vendor.json` dengan `sha256sum` berkas di `public/vendor` |
| Sidik foto | Laporan di halaman penyedia memuat `integritas.ktp` dan `integritas.swafoto` (SHA-256) |
| Uji otomatis | `npm test` memeriksa header, ketiadaan skrip sebaris, dan perhitungan SHA-256 |

## Melaporkan celah keamanan

Hubungi tim melalui kontak di halaman Devpost. Mohon tidak membuka issue publik untuk celah yang belum diperbaiki.
