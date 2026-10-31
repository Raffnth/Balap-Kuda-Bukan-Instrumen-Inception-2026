import { useEffect, useRef, useState } from 'react';
import { feedback } from '../lib/feedback.js';
import { eventText } from '../lib/messages.js';
import { useConfirmTap } from '../lib/useConfirmTap.js';

// Pilihan bantuan petugas setelah beberapa kali gagal (simulasi).
export default function Help({ settings, step, onRetry, onHome }) {
  const [requested, setRequested] = useState(false);
  const headingRef = useRef(null);
  const confirmTap = useConfirmTap(settings.nonVisual);

  useEffect(() => {
    headingRef.current?.focus();
    const how = settings.nonVisual
      ? ' Ketuk bagian atas layar untuk meminta bantuan petugas, atau bagian bawah untuk mencoba lagi.'
      : '';
    feedback.say(`${eventText('helpOffer', settings.detail)}${how}`, { interrupt: true });
    return () => feedback.stopSpeech();
  }, [settings.detail, settings.nonVisual]);

  const request = confirmTap('help', 'Minta bantuan petugas?', () => {
    setRequested(true);
    feedback.success();
    feedback.say(
      'Permintaan bantuan terkirim. Petugas akan menghubungi Anda melalui panggilan video. Foto yang sudah berhasil tidak perlu diulang.',
      { interrupt: true },
    );
  });
  const retry = confirmTap('retry', 'Coba lagi sendiri?', onRetry);

  return (
    <main className={`screen help ${settings.nonVisual ? 'nv-layout' : ''}`} aria-labelledby="help-title">
      <h1 id="help-title" ref={headingRef} tabIndex={-1}>
        Butuh bantuan?
      </h1>
      <p className="lead">
        {step === 'ktp' ? 'Foto KTP' : 'Swafoto'} belum berhasil setelah beberapa kali percobaan. Anda dapat meminta
        bantuan petugas tanpa mengulang dari awal.
      </p>
      {requested && (
        <p className="notice ok" role="status">
          Permintaan terkirim (simulasi). Petugas akan menghubungi Anda melalui panggilan video.
        </p>
      )}
      <div className="stack actions">
        <button type="button" className="btn btn-primary btn-xl help-request" onClick={request}>
          Minta bantuan petugas
        </button>
        <button type="button" className="btn btn-secondary btn-xl help-retry" onClick={retry}>
          Coba lagi sendiri
        </button>
        <button type="button" className="btn btn-ghost" onClick={onHome}>
          Kembali ke beranda
        </button>
      </div>
    </main>
  );
}
