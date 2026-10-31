import { useRef, useCallback, useEffect } from 'react';
import { feedback } from './feedback.js';

// Pada Mode Uji Non-Visual, aksi penting butuh dua ketukan:
// ketukan pertama mengucapkan konfirmasi, ketukan kedua (dalam 3 detik) menjalankan aksi.
// Pola ini aman untuk pengguna tanpa pembaca layar maupun pengguna TalkBack.
export function useConfirmTap(enabled) {
  const armed = useRef(null);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  return useCallback(
    (id, prompt, action) => () => {
      if (!enabled) {
        action();
        return;
      }
      if (armed.current === id) {
        armed.current = null;
        clearTimeout(timer.current);
        action();
        return;
      }
      armed.current = id;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        armed.current = null;
      }, 3000);
      feedback.vibrate(30);
      feedback.say(`${prompt} Ketuk sekali lagi untuk melanjutkan.`, { interrupt: true });
    },
    [enabled],
  );
}
