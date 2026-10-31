import { useEffect, useRef, useState } from 'react';
import { loadSessions, clearSessions, avgLatency } from '../lib/metrics.js';
import { IconBack } from './Icons.jsx';

const fmtMs = (v) => (v == null ? '–' : `${Math.round(v)} ms`);
const fmtSec = (v) => (v == null ? '–' : `${(v / 1000).toFixed(1)} detik`);
const detailLabel = { lengkap: 'Lengkap', ringkas: 'Ringkas', nada: 'Nada saja' };

export default function Kinerja({ onBack }) {
  const [sessions, setSessions] = useState(() => loadSessions());
  const headingRef = useRef(null);
  useEffect(() => headingRef.current?.focus(), []);

  const done = sessions.filter((s) => s.completed);
  const lat = sessions.map(avgLatency).filter((v) => v != null);
  const avgLat = lat.length ? lat.reduce((a, b) => a + b, 0) / lat.length : null;
  const maxLat = sessions.reduce((m, s) => Math.max(m, s.latency ? s.latency.max : 0), 0) || null;
  const durations = done
    .map((s) => (s.steps.ktp?.durationMs || 0) + (s.steps.selfie?.durationMs || 0))
    .filter((v) => v > 0);
  const avgDur = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  const target = avgLat != null && avgLat < 100;

  return (
    <main className="screen kinerja" aria-labelledby="kinerja-title">
      <div className="guide-top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Kembali ke beranda">
          <IconBack />
        </button>
        <h1 id="kinerja-title" ref={headingRef} tabIndex={-1}>
          Kinerja sistem
        </h1>
      </div>
      <p className="muted">Data dicatat di perangkat ini saja dan tidak dikirim ke mana pun.</p>

      <div className="stats">
        <div className="stat">
          <span className="stat-value">{fmtMs(avgLat)}</span>
          <span className="stat-label">Jeda analisis rata-rata {avgLat != null && (target ? '(target di bawah 100 ms tercapai)' : '(di atas target 100 ms)')}</span>
        </div>
        <div className="stat">
          <span className="stat-value">{sessions.length}</span>
          <span className="stat-label">Sesi tercatat, {done.length} selesai</span>
        </div>
        <div className="stat">
          <span className="stat-value">{fmtSec(avgDur)}</span>
          <span className="stat-label">Waktu penyelesaian rata-rata</span>
        </div>
        <div className="stat">
          <span className="stat-value">{fmtMs(maxLat)}</span>
          <span className="stat-label">Jeda analisis terlama</span>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <caption>Riwayat sesi terbaru</caption>
          <thead>
            <tr>
              <th scope="col">Waktu</th>
              <th scope="col">Detail suara</th>
              <th scope="col">Percobaan KTP</th>
              <th scope="col">Percobaan swafoto</th>
              <th scope="col">Jeda rata-rata</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 && (
              <tr>
                <td colSpan={6}>Belum ada sesi. Jalankan verifikasi dari beranda.</td>
              </tr>
            )}
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>{new Date(s.startedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                <td>
                  {detailLabel[s.detail] || s.detail}
                  {s.nonVisual ? ' · non-visual' : ''}
                </td>
                <td>{s.steps.ktp?.attempts ?? 0}</td>
                <td>{s.steps.selfie?.attempts ?? 0}</td>
                <td>{fmtMs(avgLatency(s))}</td>
                <td>{s.completed ? 'Selesai' : 'Belum selesai'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          clearSessions();
          setSessions([]);
        }}
      >
        Hapus data kinerja
      </button>
    </main>
  );
}
