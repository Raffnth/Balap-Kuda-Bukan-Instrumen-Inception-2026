import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { feedback } from './lib/feedback.js';

// Muat rekaman suara SonarID sejak awal (sekitar 1 MB, lalu tersimpan untuk penggunaan luring).
feedback.loadVoice();

createRoot(document.getElementById('root')).render(<App />);

// Service worker hanya di versi produksi (hasil build), agar saat pengembangan tidak ada cache lama.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
