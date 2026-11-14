// Tombol cetak kartu uji (dipisah dari HTML agar sesuai Content-Security-Policy).
document.getElementById('cetak')?.addEventListener('click', () => window.print());
