import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// publicDir: semua isi folder "public" (termasuk .htaccess, sw.js, ikon) disalin ke "dist" saat build.
export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: true,
  },
});