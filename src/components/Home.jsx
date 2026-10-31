import { useEffect, useRef, useState } from 'react';
import { DETAIL_LEVELS } from '../lib/messages.js';
import { cameraAvailable } from '../lib/camera.js';
import { feedback } from '../lib/feedback.js';
import { warmUpOcr } from '../lib/vision/ocr.js';
import { LogoMark, IconShield, IconSound } from './Icons.jsx';

export default function Home({ settings, onChange, onStart, onOpenKinerja }) {
  const headingRef = useRef(null);
  const [voice, setVoice] = useState(() => feedback.voiceStatus());
  const [tested, setTested] = useState(false);
  useEffect(() => {
    headingRef.current?.focus();
    // Daftar suara browser dimuat belakangan; periksa ulang beberapa kali.
    const check = () => setVoice(feedback.voiceStatus());
    const timers = [300, 1000, 2500].map((ms) => setTimeout(check, ms));
    // Siapkan pembaca NIK (OCR) sejak beranda agar pemeriksaan KTP nanti langsung cepat.
    timers.push(setTimeout(() => warmUpOcr().catch(() => {}), 1500));
    window.speechSynthesis?.addEventListener?.('voiceschanged', check);
    return () => {
      timers.forEach(clearTimeout);
      window.speechSynthesis?.removeEventListener?.('voiceschanged', check);
    };
  }, []);

  const runTest = () => {
    feedback.test();
    setTested(true);
    setVoice(feedback.voiceStatus());
  };

  const secure = typeof window !== 'undefined' && window.isSecureContext;
  const camOk = cameraAvailable() && secure;

  return (
    <main className="screen home" aria-labelledby="home-title">
      <header className="brand">
        <LogoMark size={44} />
        <span className="brand-name">
          Sonar<span>ID</span>
        </span>
      </header>

      <section className="hero">
        <h1 id="home-title" ref={headingRef} tabIndex={-1}>
          Verifikasi identitas tanpa melihat layar
        </h1>
        <p className="lead">
          SonarID memandu Anda memotret KTP dan wajah untuk eKYC melalui suara, nada, dan getar. Foto diambil
          otomatis saat posisi sudah tepat.
        </p>
      </section>

      <button type="button" className="btn btn-primary btn-xl start" onClick={onStart} disabled={!camOk}>
        <IconSound />
        Mulai Verifikasi
      </button>
      {!camOk && (
        <p className="notice warn" role="alert">
          Kamera tidak dapat digunakan di halaman ini. Buka SonarID melalui alamat HTTPS dan izinkan akses kamera.
        </p>
      )}

      <button type="button" className="btn btn-secondary test-av" onClick={runTest}>
        Uji suara dan getar
      </button>
      {voice === 'missing' && (
        <div className="notice warn" role="alert">
          <p>
            <strong>Suara bahasa Indonesia belum terpasang</strong>, sehingga petunjuk diucapkan dengan logat Inggris.
            Pasang dulu:
          </p>
          <ol className="steps-list">
            <li>Buka Setelan ponsel, lalu cari "Text-to-speech" (Keluaran teks-ke-ucapan).</li>
            <li>Pilih mesin "Speech Services by Google", lalu ketuk ikon setelan di sebelahnya.</li>
            <li>Pilih "Install voice data", lalu unduh "Indonesian (Indonesia)".</li>
            <li>Tutup lalu buka kembali Chrome, kemudian muat ulang halaman ini.</li>
          </ol>
        </div>
      )}
      {tested && !feedback.vibrationSupported && (
        <p className="notice warn" role="status">
          Getar tidak didukung browser ini (misalnya iPhone). Panduan tetap berjalan dengan suara dan nada.
        </p>
      )}
      {tested && feedback.vibrationSupported && (
        <p className="notice" role="status">
          Bila ponsel tidak bergetar: matikan mode senyap atau Jangan Ganggu, matikan Penghemat Baterai, dan pastikan
          Getaran atau Umpan balik sentuh aktif di Setelan ponsel.
        </p>
      )}

      <fieldset className="card group">
        <legend>Tingkat detail suara</legend>
        <div className="segmented" role="radiogroup" aria-label="Tingkat detail suara">
          {DETAIL_LEVELS.map((lv) => (
            <label key={lv.id} className={`seg ${settings.detail === lv.id ? 'on' : ''}`}>
              <input
                type="radio"
                name="detail"
                value={lv.id}
                checked={settings.detail === lv.id}
                onChange={() => onChange({ ...settings, detail: lv.id })}
              />
              <span className="seg-title">{lv.label}</span>
              <span className="seg-hint">{lv.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="card toggle-row">
        <div>
          <label htmlFor="nv" className="toggle-title">
            Mode Uji Non-Visual
          </label>
          <p id="nv-desc" className="muted">
            Layar menjadi gelap. Seluruh proses diselesaikan hanya dengan suara, nada, dan getar.
          </p>
        </div>
        <input
          id="nv"
          type="checkbox"
          role="switch"
          className="switch"
          aria-describedby="nv-desc"
          checked={settings.nonVisual}
          onChange={(e) => onChange({ ...settings, nonVisual: e.target.checked })}
        />
      </div>

      <p className="privacy">
        <IconShield className="ico-teal" />
        <span>
          Semua analisis berlangsung di ponsel Anda. Gambar dari kamera tidak disimpan dan tidak dikirim ke server.
          Isi KTP tidak pernah dibacakan.
        </span>
      </p>

      <nav className="links" aria-label="Tautan lain">
        <a href="/kartu-uji.html" target="_blank" rel="noopener">
          Kartu uji pengganti KTP
        </a>
        <button type="button" className="linklike" onClick={onOpenKinerja}>
          Halaman kinerja
        </button>
      </nav>
    </main>
  );
}
