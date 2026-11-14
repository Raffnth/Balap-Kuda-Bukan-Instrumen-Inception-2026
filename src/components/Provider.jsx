import { useEffect, useRef } from 'react';
import { feedback } from '../lib/feedback.js';
import { eventText, PHRASES, PROVIDER_NAME } from '../lib/messages.js';
import { useConfirmTap } from '../lib/useConfirmTap.js';
import { IconCheck } from './Icons.jsx';

// Simulasi aplikasi penyedia eKYC (merek fiktif) yang memasang komponen SonarID.
// Tidak ada data yang dikirim ke server: laporan ini hanya ditampilkan di perangkat.
export default function Provider({ settings, ktp, selfie, onFinish }) {
  const headingRef = useRef(null);
  const confirmTap = useConfirmTap(settings.nonVisual);

  useEffect(() => {
    headingRef.current?.focus();
    feedback.success();
    const how = settings.nonVisual ? ` ${PHRASES.providerHowNv}` : '';
    feedback.say(`${eventText('sent', settings.detail)}${how}`, { interrupt: true });
    return () => feedback.stopSpeech();
  }, [settings.detail, settings.nonVisual]);

  const report = {
    komponen: 'SonarID',
    ktp: Object.fromEntries(ktp.checks.map((c) => [c.id, c.ok ? 'lulus' : 'gagal'])),
    swafoto: Object.fromEntries(selfie.checks.map((c) => [c.id, c.ok ? 'lulus' : 'gagal'])),
    percobaan: { ktp: ktp.attempts, swafoto: selfie.attempts },
    // Sidik foto saat lulus Quality Check: penyedia mencocokkan dengan foto yang diterima.
    integritas: {
      algoritma: 'SHA-256',
      ktp: ktp.sha256 || 'tidak tersedia',
      swafoto: selfie.sha256 || 'tidak tersedia',
    },
    waktu: { ktp: ktp.at || null, swafoto: selfie.at || null },
    catatan: 'Keputusan verifikasi akhir tetap milik penyedia.',
  };

  const finish = confirmTap('finish', PHRASES.confirmFinish, onFinish);

  return (
    <main className={`screen provider ${settings.nonVisual ? 'nv-layout' : ''}`} aria-labelledby="provider-title">
      <div className="provider-bar" aria-hidden="true">
        <span className="provider-logo">BCN</span>
        <span>{PROVIDER_NAME}</span>
        <span className="demo-tag">Simulasi</span>
      </div>
      <div className="provider-ok">
        <IconCheck className="ico-ok big" />
        <h1 id="provider-title" ref={headingRef} tabIndex={-1}>
          Foto diterima
        </h1>
        <p className="lead">Verifikasi identitas Anda sedang diproses oleh {PROVIDER_NAME}.</p>
      </div>

      <section className="card">
        <h2>Laporan kualitas yang diterima penyedia</h2>
        <pre className="report" aria-label="Laporan kualitas dalam format data">
          {JSON.stringify(report, null, 2)}
        </pre>
        <p className="muted">
          Sidik SHA-256 dihitung di ponsel saat foto lulus pemeriksaan. Penyedia menghitung ulang sidik foto yang
          diterima; bila berbeda, foto telah diubah dan harus ditolak.
        </p>
        <p className="muted">
          Ini adalah simulasi integrasi. Pada pemakaian nyata, aplikasi penyedia menerima foto dan laporan ini melalui
          komponen SonarID, lalu menjalankan pemeriksaan keaslian sendiri.
        </p>
      </section>

      <button type="button" className="btn btn-primary btn-xl finish" onClick={finish}>
        Selesai
      </button>
    </main>
  );
}
